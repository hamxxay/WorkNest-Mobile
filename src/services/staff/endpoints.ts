// API paths used by the staff apps (relative to API_BASE_URL, which already ends in /api). Mirrors the web CMS
// services (WorkNest_FE src/app/services/*.ts) and the API controllers (WN_APIs WorkNest.API/Controllers).
// Query strings are added by the services with normalize.withQuery. Kept apart from config/api.ts (customer app).

type Id = number | string;
const seg = (value: Id) => encodeURIComponent(String(value));

export const STAFF_ENDPOINTS = {
  auth: {
    /** GET own profile: { id, email, name, phone, role, roles, locationId, locationIds, customerId }; PUT { name, phone }. */
    me: "/auth/me",
  },
  dashboard: {
    role: "/dashboard/role",
    overview: "/dashboard/overview",
    forecast: "/dashboard/forecast",
    navBadges: "/admin/nav-badges",
    navBadgesRead: "/admin/nav-badges/read",
    accessOverview: "/access-suspensions/overview",
    /** GET chart drill-down of the overview: the records behind one bar / slice / point (kind = revenue-month, ...). */
    overviewDetails: (kind: string) => `/dashboard/overview-details/${seg(kind)}`,
  },
  customers: {
    list: "/customer",
    search: "/customer/search",
    byId: (id: Id) => `/customer/${seg(id)}`,
    create: "/customer",
    update: (id: Id) => `/customer/${seg(id)}`,
    /** Customer's invoices (paged): GET customer/{id}/invoices?page=&limit=&statusId= */
    invoices: (customerId: Id) => `/customer/${seg(customerId)}/invoices`,
    /** Customer's attendants (people with door access). */
    attendants: (customerId: Id) => `/customers/${seg(customerId)}/attendants`,
    /** Customer's booked spaces with a running booking (to assign attendants). */
    activeSpaces: (customerId: Id) => `/customers/${seg(customerId)}/active-spaces`,
  },
  cities: "/city",
  kyc: {
    list: "/kyc",
    customer: (customerIdOrGuid: Id) => `/kyc/${seg(customerIdOrGuid)}`,
    upload: "/kyc/upload",
    verify: "/kyc/verify",
    reject: "/kyc/reject",
    history: (customerId: Id, documentTypeId: Id, slotNo: Id) =>
      `/kyc/history/${seg(customerId)}/${seg(documentTypeId)}/${seg(slotNo)}`,
    /** Document file (needs the login token). `inline=true` only changes Content-Disposition. */
    document: (documentId: Id) => `/kyc/document/${seg(documentId)}/download`,
  },
  quotations: {
    list: "/quotation",
    /** A customer's quotations (staff, or the customer). */
    byCustomer: (customerId: Id) => `/quotation/by-customer/${seg(customerId)}`,
    byId: (id: Id) => `/quotation/${seg(id)}`,
    create: "/quotation",
    versions: (id: Id) => `/quotation/${seg(id)}/versions`,
    version: (id: Id, versionNumber: Id) => `/quotation/${seg(id)}/versions/${seg(versionNumber)}`,
    /** POST, no body: clones row {id} into a new Draft version (the body is ignored by the API). */
    createVersion: (id: Id) => `/quotation/${seg(id)}/versions`,
    /** POST {}: marks that version Sent. (The bare /{id}/send route always targets version 1.) */
    sendVersion: (id: Id, versionNumber: Id) => `/quotation/${seg(id)}/versions/${seg(versionNumber)}/send`,
    /** POST { email }: the server builds the PDF itself and emails it. */
    sendEmail: (id: Id) => `/quotation/${seg(id)}/send-email`,
    pdf: (id: Id) => `/quotation/${seg(id)}/pdf`,
    versionPdf: (id: Id, versionNumber: Id) => `/quotation/${seg(id)}/versions/${seg(versionNumber)}/pdf`,
    offeringTypes: "/quotation/offering-types",
    history: "/quotation/history",
    activities: "/quotation/activities",
    responses: "/quotation/responses",
  },
  bookings: {
    list: "/booking",
    /** Details (there is no /booking/{id}/details route). */
    byId: (id: Id) => `/booking/${seg(id)}`,
    /** One booking in the list-row shape. */
    row: (id: Id) => `/booking/${seg(id)}/row`,
    /** Challan / billing summary (ChallanResponseDto). */
    billingSummary: (id: Id) => `/booking/${seg(id)}/billing-summary`,
    challan: (id: Id) => `/booking/${seg(id)}/challan`,
    challanPdf: (id: Id) => `/booking/${seg(id)}/challan-pdf`,
    sendChallanEmail: (id: Id) => `/booking/${seg(id)}/send-challan-email`,
    sendConfirmationEmail: (id: Id) => `/booking/${seg(id)}/send-confirmation-email`,
    /** PATCH { statusId } — staff status change (cancel = 86). */
    status: (id: Id) => `/booking/${seg(id)}/status`,
    /** PUT { startDateTime?, endDateTime?, notes? } */
    update: (id: Id) => `/booking/${seg(id)}`,
    /** PATCH { newSpaceId } */
    reassign: (id: Id) => `/booking/${seg(id)}/reassign`,
    reassignmentSpaces: "/booking/available-spaces-reassignment",
    calendar: "/booking/calendar",
    createAdmin: "/booking/create-admin",
    /** POST ?preview=&issuedOn=&invoiceType=&whTaxId= — first invoice of a booking (preview or create / resend). */
    sendInitialInvoice: (id: Id) => `/booking/${seg(id)}/send-initial-invoice`,
    /** GET { sent, invoiceId, invoiceNumber } — whether the first invoice exists yet (newer API only). */
    initialInvoiceStatus: (id: Id) => `/booking/${seg(id)}/initial-invoice`,
  },
  agreements: {
    list: "/agreement",
    send: "/agreement/send",
    pdf: (id: Id) => `/agreement/${seg(id)}/pdf`,
    signedPdf: (id: Id) => `/agreement/${seg(id)}/signed-pdf`,
    /** POST { note? } — needs the signed copy on file; creates the booking. */
    markSigned: (id: Id) => `/agreement/${seg(id)}/mark-signed`,
    /** POST multipart: file?, signedDate, note? — saves the signed copy and creates the booking. */
    sign: (id: Id) => `/agreement/${seg(id)}/sign`,
    /** POST multipart: file — stores the signed copy only. */
    uploadSigned: (id: Id) => `/agreement/${seg(id)}/upload-signed`,
    esignature: (id: Id) => `/agreement/${seg(id)}/esignature`,
  },
  invoices: {
    list: "/invoice",
    byId: (id: Id) => `/invoice/${seg(id)}`,
    pdf: (id: Id) => `/invoice/${seg(id)}/pdf`,
    statementPdf: (id: Id) => `/invoice/${seg(id)}/statement-pdf`,
    sendEmail: (id: Id) => `/invoice/${seg(id)}/send-email`,
    /** POST { paidAmount, paymentMethod, transactionRef?, notes? } -> { paidTotal, statusId } */
    recordPayment: (id: Id) => `/invoice/${seg(id)}/record-payment`,
  },
  attendants: {
    /** POST { customerId, name, email, phone, idType, idNumber } — create / link a person. */
    create: "/attendants",
    /** PUT { name, email, phone } */
    update: (personId: Id) => `/attendants/${seg(personId)}`,
    byBooking: (bookingDetailId: Id) => `/bookings/${seg(bookingDetailId)}/attendants`,
    /** POST { personId, customerId } — assign to a booked space. */
    assign: (bookingDetailId: Id) => `/bookings/${seg(bookingDetailId)}/attendants`,
    remove: (bookingDetailId: Id, personId: Id) => `/bookings/${seg(bookingDetailId)}/attendants/${seg(personId)}`,
    capacityCheck: (bookingDetailId: Id) => `/bookings/${seg(bookingDetailId)}/capacity-check`,
    /** PATCH { bookingDetailId, customerId, personId|null, isEnabled } */
    accessStatus: "/access-status",
    accessSuspension: (bookingDetailId: Id) => `/bookings/${seg(bookingDetailId)}/access-suspension`,
    /** POST { overrideUntil: yyyy-MM-dd, reason } — temporary access while suspended. */
    extendAccess: (bookingDetailId: Id) => `/bookings/${seg(bookingDetailId)}/access-suspension/extend`,
    challans: (bookingDetailId: Id) => `/bookings/${seg(bookingDetailId)}/challans`,
    /** POST { idNumber } — a customer-added employee: CNIC check, then on the room (404 canAddManually, 409 already on it). */
    byCnic: (bookingDetailId: Id) => `/bookings/${seg(bookingDetailId)}/attendants/by-cnic`,
    /** GET { checked, name, online, canEnrol, reason } — the room machine an enrolment captures on (newer API only). */
    roomMachine: (bookingDetailId: Id) => `/bookings/${seg(bookingDetailId)}/room-machine`,
    /** POST { fingerNo, cardNo? } — fingerprint / face / card on the room machine, copied to the entrances. */
    enrol: (bookingDetailId: Id, personId: Id, kind: "fingerprint" | "face" | "card") =>
      `/bookings/${seg(bookingDetailId)}/attendants/${seg(personId)}/hik/${kind}`,
  },
  capacityRequests: {
    /** POST { personId, customerId }: a sales executive asks an admin to add a person to a full room. */
    create: (bookingDetailId: Id) => `/bookings/${seg(bookingDetailId)}/capacity-requests`,
    list: "/capacity-requests",
    approve: (id: Id) => `/capacity-requests/${seg(id)}/approve`,
    reject: (id: Id) => `/capacity-requests/${seg(id)}/reject`,
    cancel: (id: Id) => `/capacity-requests/${seg(id)}/cancel`,
  },
  challan: {
    search: "/challan/search",
    extendValidity: "/challan/extend-validity",
  },
  complaints: {
    list: "/complaints",
    create: "/complaints",
    status: (id: Id) => `/complaints/${seg(id)}/status`,
    /** PATCH { locationId } — set / change the complaint's branch (location-bound staff: one of their locations). */
    branch: (id: Id) => `/complaints/${seg(id)}/branch`,
  },
  inquiries: {
    /**
     * PATCH { statusId } (1 New, 2 In progress, 3 Resolved, 4 Closed) by public id. List / feedback and the path for a
     * row without a public id (id + ?source=): services/contactService.ts inquiryPath.
     */
    status: (id: Id) => `/contact/${seg(id)}/status`,
    /** PATCH { locationId } by the inquiry's public id — set / change its branch (location-bound: one of theirs). */
    location: (publicId: Id) => `/contact/${seg(publicId)}/location`,
    /**
     * GET by the inquiry's public id: { phone, text, url } — the first WhatsApp message to that inquiry, rendered by
     * the API from the CMS template ("Message templates") for the signed-in staff member; 404 when they can't see it.
     */
    whatsappMessage: (publicId: Id) => `/contact/${seg(publicId)}/whatsapp-message`,
  },
  access: {
    dashboard: "/hik/access/dashboard",
    events: "/hik/access/events",
    activity: "/hik/access/activity",
    analytics: "/hik/access/analytics",
    userAnalytics: "/hik/access/analytics/user",
    devices: "/devices",
  },
  users: {
    list: "/user",
  },
  lookups: {
    /** Paged { data, total }; admins / sales executives get their own locations only. */
    locations: "/location",
    floors: "/floor",
    spaceTypes: "/spacetype",
    /** Paged { data, total }; no location / type filter on the server (filter on the device, as the CMS does). */
    spaces: "/space",
    /** Space detail (there is no GET /space/{id}). */
    spaceSummary: (idOrGuid: Id) => `/space/${seg(idOrGuid)}/summary`,
    spaceConfig: "/space-config",
    billingPeriods: "/billing-periods",
    /** WHT rate options (dbo.WN_WHTaxRate): [{ id, description, rate }] (staff roles). */
    whtRates: "/amount-fields/wht-rates",
  },
} as const;
