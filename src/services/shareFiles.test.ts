import RNShare from "react-native-share";
import { pdfBaseName, sharePdf } from "./pdfService";
import { openStaffFile } from "./staff/files";

jest.mock("react-native-share", () => ({ __esModule: true, default: { open: jest.fn(() => Promise.resolve({})) } }));
jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn(() => Promise.resolve()) },
}));
jest.mock("../utils/authStorage", () => ({ getToken: jest.fn(), getUser: jest.fn() }));

const openMock = RNShare.open as unknown as jest.Mock;

beforeEach(() => openMock.mockClear());

describe("shared files stay in the app's private cache under a clean name", () => {
  it("sharePdf writes to internal storage and cleans the server file name", async () => {
    await sharePdf({ base64: "JVBERi0=", contentType: "application/pdf", fileName: "../../files/Challan 12.pdf" }, "Challan", "Challan");

    expect(openMock).toHaveBeenCalledWith(
      expect.objectContaining({ useInternalStorage: true, filename: "Challan-12", type: "application/pdf" }),
    );
  });

  it("openStaffFile (KYC documents) writes to internal storage and cleans the name", async () => {
    await openStaffFile({
      dataUrl: "data:image/jpeg;base64,/9j/",
      base64: "/9j/",
      mimeType: "image/jpeg",
      fileName: "..\\..\\shared_prefs\\CNIC front.jpg",
    });

    expect(openMock).toHaveBeenCalledWith(
      expect.objectContaining({ useInternalStorage: true, filename: "CNIC-front", title: "CNIC-front" }),
    );
  });

  it("pdfBaseName keeps its behaviour", () => {
    expect(pdfBaseName("WorkNest Invoice #7.pdf", "Invoice")).toBe("WorkNest-Invoice-7");
    expect(pdfBaseName(null, "Invoice")).toBe("Invoice");
  });
});
