import { buildWorkspaceList, capacityLabel, listedRate, type ApiWorkspace } from "./workspaceService";

jest.mock("../utils/authStorage", () => ({ getToken: jest.fn(), getUser: jest.fn() }));

// Shape of GET /space/available rows (test database, I-8).
const office = (id: number, name: string, capacity: number, seatPrice: number, extra: Partial<ApiWorkspace> = {}): ApiWorkspace => ({
  id,
  name,
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
  it("describes the whole category: seat range, lowest price and counts, not the first space", () => {
    const [card, meeting] = buildWorkspaceList([
      office(1, "Shared Space 1", 1, 30000),
      office(2, "Office 301", 5, 35000),
      office(3, "Office 340", 9, 35000, { amenities: "WiFi, AC" }),
      office(4, "Office 341", 2, 10000, { spaceStatus: "Booked", amenities: "WiFi, Parking" }),
      { id: 9, name: "Meeting Room 1", locationName: "I-8", spaceTypeName: "Meeting Room", capacity: 8, seatPrice: 6000, roomPrice: 6000, billingPeriodCode: "Hourly" },
    ]);

    expect(card).toMatchObject({
      name: "Private Office",
      type: "Private Office",
      location: "I-8",
      availableCount: 3,
      totalCount: 4,
      minCapacity: 1,
      maxCapacity: 9,
      capacity: "1-9",
      // Lowest room price among the AVAILABLE spaces (the booked 2-seat office at 20,000 is left out).
      price: 30000,
      priceUnit: "Monthly",
      amenities: ["WiFi", "AC"],
      available: true,
    });
    expect(capacityLabel(card)).toBe("1-9 seats");
    expect(listedRate(card)).toBe("From PKR 30,000 / month");

    expect(meeting).toMatchObject({ name: "Meeting Room", capacity: "8", price: 6000, totalCount: 1 });
    expect(capacityLabel(meeting)).toBe("8 seats");
    expect(listedRate(meeting)).toBe("PKR 6,000 / hour");
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
    expect(capacityLabel(unpriced)).toBe("");
  });

  it("keeps a fully booked category listed (with its prices) but not available", () => {
    const [card] = buildWorkspaceList([office(1, "Office 1", 4, 30000, { spaceStatus: "Booked" })]);
    expect(card).toMatchObject({ availableCount: 0, totalCount: 1, available: false, price: 120000 });
  });
});
