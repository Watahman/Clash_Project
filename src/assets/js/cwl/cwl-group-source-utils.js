export function normalizePolls(polls) {
    return (Array.isArray(polls) ? polls : [])
        .filter(poll => poll?.type === "cwl_availability")
        .sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
}
