import {
  buildWorkspaceList,
  capacityLabel,
  listedRate,
  normalizeSpaceType,
  periodPrice,
  type ApiWorkspace,
} from "./workspaceService";

jest.mock("../utils/authStorage", () => ({ getToken: jest.fn(), getUser: jest.fn() }));

// Shape of GET /space/available rows (test database, I-8 = location 1).
const office = (id: number, name: string, capacity: number, seatPrice: number, extra: Partial<ApiWorkspace> = {}): ApiWorkspace => ({
  id,
  name,
  locationId: 1,
  locationName: "I-8",
  spaceTypeName: "Private Office",
  categoryCode: "PrivateOffice",
  capacity,
  seatPrice,
  roomPrice: seatPrice * capacity,
  billingPeriodCode: "Monthly",
  ...extra,
});

describe("space cards (one per category and location)", () => {
  it("describes the whole category: seat range, lowest whole-office price and counts, not the first space", () => {
    const [card, meeting] = buildWorkspaceList([
      office(1, "Shared Space 1", 1, 30000),
      office(2, "Office 301", 5, 35000),
      office(3, "Office 340", 9, 35000, { amenities: "WiFi, AC" }),
      office(4, "Office 341", 2, 10000, { spaceStatus: "Booked", amenities: "WiFi, Parking" }),
      { id: 9, name: "Meeting Room 1", locationId: 1, locationName: "I-8", spaceTypeName: "Meeting Room", categoryCode: "MeetingRoom", capacity: 8, seatPrice: 6000, roomPrice: 48000, billingPeriodCode: "Hourly" },
    ]);

    expect(card).toMatchObject({
      name: "Private Office",
      type: "Private Office",
      location: "I-8",
      locationId: 1,
      spaceIds: [1, 2, 3, 4],
      availableCount: 3,
      totalCount: 4,
      minCapacity: 1,
      maxCapacity: 9,
      capacity: "1-9",
      // Lowest whole-office price among the spaces free now (the booked 2-seat office at 20,000 is left out).
      price: 30000,
      maxPrice: 315000,
      priceUnit: "Monthly",
      amenities: ["WiFi", "AC", "Parking"],
      available: true,
      bookable: true,
      occupancyKnown: false,
    });
    expect(capacityLabel(card)).toBe("1-9 seats");
    expect(listedRate(card)).toBe("From PKR 30,000 / month");

    // A meeting room is charged its seat price per hour (not seat x capacity).
    expect(meeting).toMatchObject({ name: "Meeting Room", capacity: "8", price: 6000, totalCount: 1 });
    expect(capacityLabel(meeting)).toBe("8 seats");
    expect(listedRate(meeting)).toBe("PKR 6,000 / hour");
  });

  it("says From only when the spaces cost different amounts", () => {
    const desks = buildWorkspaceList(
      [1, 2, 3].map((id) => ({ id, locationId: 1, locationName: "I-8", categoryCode: "SharedSpace", spaceTypeName: "Co-Working Space", capacity: 1, seatPrice: 30000, roomPrice: 30000, billingPeriodCode: "Monthly" })),
    )[0];
    expect(desks.type).toBe("Co-Working Space");
    expect(listedRate(desks)).toBe("PKR 30,000 / month");
  });

  it("uses the seat price when a space has no room price, and says when there is no price", () => {
    const [card] = buildWorkspaceList([
      { id: 1, name: "Desk 1", locationName: "I-8", spaceTypeName: "Co-Working Space", capacity: 1, seatPrice: 20000, billingPeriodCode: "Monthly" },
      { id: 2, name: "Desk 2", locationName: "I-8", spaceTypeName: "Co-Working Space", capacity: 1, seatPrice: null, roomPrice: null },
    ]);
    expect(card.price).toBe(20000);
    expect(capacityLabel(card)).toBe("1 seat");

    const [unpriced] = buildWorkspaceList([{ id: 5, name: "Meeting Room 2", locationName: "I-8", spaceTypeName: "Meeting Room" }]);
    expect(listedRate(unpriced)).toBe("Price on request");
    expect(unpriced.bookable).toBe(false);
    expect(capacityLabel(unpriced)).toBe("");
  });

  it("keeps a category whose spaces are all booked right now, still bookable for other dates", () => {
    const [card] = buildWorkspaceList([
      office(1, "Office 1", 4, 30000, { occupiedNow: true }),
      office(2, "Office 2", 5, 30000, { occupiedNow: true }),
    ]);
    expect(card).toMatchObject({
      availableCount: 0,
      totalCount: 2,
      available: false,
      occupancyKnown: true,
      bookable: true,
      price: 120000,
    });
  });

  it("makes one card per location: an F-7 office is never grouped with I-8", () => {
    const cards = buildWorkspaceList([
      office(1, "Office 301", 5, 35000),
      office(200, "Office F1", 3, 35000, { locationId: 2, locationName: "F-7" }),
    ]);
    expect(cards.map((c) => [c.location, c.locationId])).toEqual([
      ["I-8", 1],
      ["F-7", 2],
    ]);
  });

  it("groups by the API's category code, not by words in the name", () => {
    expect(normalizeSpaceType({ categoryCode: "SharedSpace" })).toBe("Co-Working Space");
    expect(normalizeSpaceType({ categoryCode: "PrivateOffice", spaceTypeName: "Corner Office" })).toBe("Private Office");
    expect(normalizeSpaceType({ categoryCode: "MeetingRoom" })).toBe("Meeting Room");
    expect(normalizeSpaceType({ categoryCode: "Conference" })).toBe("Meeting Room");
    // Without a code: whole words only ("co" in "Corner" or "Conference" no longer means co-working).
    expect(normalizeSpaceType({ spaceTypeName: "Corner Office" })).toBe("Private Office");
    expect(normalizeSpaceType({ spaceTypeName: "Conference Hall" })).toBe("Meeting Room");
    expect(normalizeSpaceType({ spaceTypeName: "Co-Working Space" })).toBe("Co-Working Space");
    expect(normalizeSpaceType({ spaceTypeName: "Hot Desk" })).toBe("Co-Working Space");
  });

  it("prices a private office whole and other spaces per seat", () => {
    expect(periodPrice({ categoryCode: "PrivateOffice", seatPrice: 35000, roomPrice: 175000, capacity: 5 })).toBe(175000);
    expect(periodPrice({ categoryCode: "PrivateOffice", seatPrice: 35000, capacity: 3 })).toBe(105000);
    expect(periodPrice({ categoryCode: "MeetingRoom", seatPrice: 6000, roomPrice: 48000, capacity: 8 })).toBe(6000);
    expect(periodPrice({ categoryCode: "SharedSpace", seatPrice: 30000, roomPrice: 30000, capacity: 1 })).toBe(30000);
    expect(periodPrice({ categoryCode: "PrivateOffice" })).toBe(0);
  });

  it("shows a gallery photo linked to one of the card's spaces, else to its location, else none", () => {
    const rows = [office(71, "Office 301", 5, 35000), office(72, "Office 302", 5, 35000)];
    const gallery = [
      { imageUrl: "https://cdn.example.com/f7.jpg", locationId: 2, spaceId: null },
      { imageUrl: "https://cdn.example.com/i8.jpg", locationId: 1, spaceId: null },
      { imageUrl: "https://cdn.example.com/office-302.jpg", locationId: 1, spaceId: 72 },
    ];
    expect(buildWorkspaceList(rows, gallery)[0].image).toBe("https://cdn.example.com/office-302.jpg");
    expect(buildWorkspaceList(rows, gallery.slice(0, 2))[0].image).toBe("https://cdn.example.com/i8.jpg");
    expect(buildWorkspaceList(rows, gallery.slice(0, 1))[0].image).toBe("");
    expect(buildWorkspaceList(rows)[0].image).toBe("");
    // The space's own photo comes first.
    expect(buildWorkspaceList([office(71, "Office 301", 5, 35000, { imageUrl: "https://cdn.example.com/own.jpg" })], gallery)[0].image).toBe(
      "https://cdn.example.com/own.jpg",
    );
  });
});
