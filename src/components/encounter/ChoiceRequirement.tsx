export function ChoiceRequirement({ reason }: { reason?: string }) {
  if (!reason) {
    return null;
  }
  return <p className="choice-requirement">{reason}</p>;
}
