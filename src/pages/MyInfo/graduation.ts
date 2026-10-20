export function graduationSemester(date: string): string {
  const month = date.slice(5, 7);
  return month === "02" || month === "08" ? month : "";
}

export function graduationDate(year: string, semester: string): string | null {
  if (!year && !semester) return null;
  if (!/^\d{4}$/.test(year) || !["02", "08"].includes(semester)) throw new Error("graduation period required");
  const lastDay = new Date(Date.UTC(Number(year), Number(semester), 0)).getUTCDate();
  return `${year}-${semester}-${lastDay}`;
}
