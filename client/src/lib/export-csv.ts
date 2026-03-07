export function exportToCsv(filename: string, rows: Record<string, any>[]) {
  if (!rows || rows.length === 0) return;
  
  const headers = Object.keys(rows[0]);
  const csvContent = [
    headers.join(","),
    ...rows.map(row => 
      headers.map(header => {
        const val = row[header] ?? "";
        const stringified = typeof val === 'object' ? JSON.stringify(val) : String(val);
        // Escape quotes and wrap in quotes
        return `"${stringified.replace(/"/g, '""')}"`;
      }).join(",")
    )
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
