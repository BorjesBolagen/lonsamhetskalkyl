/**
 * iLogTypes — TypeScript-definitioner för all iLog-data.
 * 
 * Dessa typer representerar den rena, mappade datan som frontend använder.
 * Datatypen är abstrakt från iLog's komplexa JSON-struktur och fokuserar på
 * de fält som är relevanta för UI:n.
 * 
 * De mappas från rå iLog-svar via ilogMappers.ts.
 */

/**
 * Enkelt ekipage-objekt för listor och dropdowns.
 */
export type EquipageItem = {
    id: number;
    name: string;
};

/**
 * En linje/zonrelation fran iLog (för visning och filtrering på hemskärm).
 */
export type LineItem = {
    id: number;
    name: string;
    fromArea: string;
    toArea: string;
};

/**
 * En consignment i en lista (försummat format).
 * 
 * Innehåller grundläggande info för att visas i tabeller/listor.
 * För fler detaljer (historia, events), använd ConsignmentDetail via 
 * /api/ilog/consignment?consignmentId=X.
 */
export type ConsignmentListItem = {
    consignmentId: number;
    waybillnumber: string;
    status: string;
    sender: string;
    receiver: string;
    weight: number | null;
    customerName: string;
    zoneName: string;
    equipageName: string;
    pickupDate: string;
    positioning: string;
    comment: string;
};

/**
 * Full detalj för en enskild consignment.
 * 
 * Innehåller allt från ConsignmentListItem + extra fält för detaljvyn.
 * Hämtas från GET /api/ilog/consignment?consignmentId=X.
 */
export type ConsignmentDetail = {
    consignmentId: number;
    waybillnumber: string;
    status: string;
    sender: string;
    receiver: string;
    pickupCity: string;
    destinationCity: string;
    weight: number | null;
    kolli: number | null;
    comment: string;
    customerName: string;
    zoneName: string;
    equipageName: string;
    pickupDate: string;
    positioning: string;
    opalBookingId: number | null;
    transporterType: string;
    ilogStatus: string;
};

