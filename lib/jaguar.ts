export const crew = [
    { name: "Lavanya Balaji", email: "lavanyabalaji123@gmail.com", role: "owner", area: "Project Lead / Project Manager" },
    { name: "Premothan V", email: "mechpremothan@gmail.com", role: "cohort_leader", area: "Crew Lead / Team Lead" },
    { name: "Surjith Kumar", email: "suryasurjith1997@gmail.com", role: "learner", area: "Enterprise & workforce structures" },
    { name: "Stephen Praveen A", email: "stephan@cloudheard.org", role: "learner", area: "Core HR, employee lifecycle & testing" },
    { name: "Abinesh S", email: "sasiabinesh292@gmail.com", role: "learner", area: "Data, HDL & reconciliation" },
] as const;
export type Identity = {
    name: string;
    email: string;
    role: "owner" | "cohort_leader" | "learner";
};
export type CrewRecord = {
    id: string;
    kind: string;
    author: string;
    data: Record<string, any>;
    createdAt: string;
    updatedAt: string;
    revision: number;
};
export const phases = [["Initiation", "W1", "Kickoff, access and scope"], ["Discovery & design", "W2–3", "Requirements and recorded design decisions"], ["Build", "W4–7", "Configuration, HDL and unit testing"], ["System test", "W8–9", "End-to-end integration testing"], ["UAT", "W10–11", "Business scenarios and sign-off"], ["Cutover", "W12", "Mock cutover and simulated go-live"]];
export const entities = [
    ["India", "TMS Motors India Private Limited", "India LDG", "TMS India Business Unit", "Chennai"],
    ["United Kingdom", "TMS Automotive UK Limited", "UK LDG", "TMS UK Business Unit", "London"],
    ["Austria", "TMS Automotive Austria GmbH", "Austria LDG", "TMS Austria Business Unit", "Vienna"],
    ["Philippines", "TMS Motors Philippines Inc.", "PH LDG", "TMS Philippines Business Unit", "Taguig"],
];
export const clientBrief = "TMS Motors Group is a fictional training client moving 6,000 synthetic workers from Oracle EBS to a fresh Oracle Fusion HCM instance across India, United Kingdom, Austria and Philippines. Four legal employers, four LDGs, four business units, four primary locations, five reference data sets, 44 departments, 10 job families, 50 jobs, eight grades. Twelve-week implementation begins 5 October 2026. Scope: enterprise/workforce structures, Core HR, employee lifecycle, data migration/HDL/reconciliation, absence, security/approvals, journeys/notifications, reports/integrations, testing and cutover. No real client or employee data; no live Oracle integration is connected.";
export const rules = [["START", "Be ready at 10:00 IST. Give notice of a planned delay by 09:45."], ["MEETINGS", "Record PM meetings and circulate actions within 30 minutes."], ["ACTIONS", "A three-hour action is due within 180 minutes. State an owner and deadline."], ["BLOCKERS", "Raise a blocker before the deadline, with evidence and a revised ETA."], ["CHANGES", "Inform TL/PM of changed decisions within 15 minutes and record the decision."], ["EVIDENCE", "Done requires accessible evidence, acceptance criteria, review and explicit hand-off."]] as const;
export const fundamentals = ["ERP and the employee lifecycle", "Oracle EBS versus Fusion Cloud", "Development, test and production instances", "Cloning and masking training data", "SDLC and implementation phases", "Enterprise and workforce structures", "Roles, approvals and data access", "HDL and data reconciliation", "Evidence, testing and acceptance criteria", "Dependencies, RAID and communication"];
export function istDate(now = new Date()) { return new Date(now.getTime() + 330 * 60000).toISOString().slice(0, 10); }
export function canControl(u: Identity) { return u.role === "owner" || u.role === "cohort_leader"; }
export function canSeeScenario(r: CrewRecord, u: Identity, now = new Date()) {
    if (r.kind !== "scenario" || u.role === "owner")
        return true;
    if (u.role === "cohort_leader" && istDate(now) >= "2026-10-20")
        return true;
    return r.data.published === true && typeof r.data.releaseAt === "string" && Date.parse(r.data.releaseAt) <= now.getTime() && istDate(now) >= "2026-10-20";
}
export function visibleRecords(records: CrewRecord[], u: Identity, now = new Date()) { return records.filter(r => canSeeScenario(r, u, now) && (r.kind !== "guide" || r.author === u.email) && (r.kind !== "receipt" || r.author === u.email)); }
export function energyState(records: CrewRecord[], email: string) { let life = 1, energy = 2; for (const r of records.filter(r => r.kind === "energy" && r.data.rider === email && r.data.appealStatus !== "upheld").sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    energy--;
    if (energy === 0 && life < 3) {
        life++;
        energy = 3;
    }
} return { life, energy, reviewRequired: life === 3 && energy === 0 }; }
export function appealDeadline(now = new Date()) {
    let local = new Date(now.getTime() + 330 * 60000), remaining = 120;
    while (remaining > 0) {
        local = new Date(local.getTime() + 60000);
        const day = local.getUTCDay(), minute = local.getUTCHours() * 60 + local.getUTCMinutes();
        if (day !== 0 && day !== 6 && minute >= 600 && minute < 1080)
            remaining--;
    }
    return new Date(local.getTime() - 330 * 60000).toISOString();
}
