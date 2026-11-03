/** Client-side shapes and labels for support tickets (mirrors lib/tickets-server.ts). */
export type TicketView = {
  id: string; userId: string; name: string; email: string; role: string; organization: string;
  category: "problem" | "idea" | "question" | "account"; subject: string; details: string; page: string;
  status: "open" | "in_progress" | "resolved"; adminNote: string; createdAt: string; updatedAt: string;
};
export const CATEGORY_LABELS: Record<TicketView["category"], string> = { problem: "Something isn't working", question: "A question", idea: "An idea or request", account: "My account or sign-in" };
export const STATUS_LABELS: Record<TicketView["status"], string> = { open: "Open", in_progress: "In progress", resolved: "Done" };
export const ROLE_LABELS: Record<string, string> = { admin: "Admin", user: "Consultant", sales_manager: "Sales Manager", fni: "F&I" };
