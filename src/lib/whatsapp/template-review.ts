/** Pending, approved and other existing variants must not be submitted again. */
export function templateReviewAction(status: string | null | undefined): "create" | "update" | null {
  if (!status) return "create";
  return status.toUpperCase() === "REJECTED" ? "update" : null;
}
