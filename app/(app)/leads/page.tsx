import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/domain/PageHeader";

export default function LeadsPage() {
  return (
    <>
      <PageHeader title="Leads" />
      <Card className="items-center px-4 py-12 text-center">
        <p className="font-medium">Noch keine Leads</p>
        <p className="text-sm text-muted-foreground">
          Die Lead-Verwaltung mit Liste und Pipeline folgt in Milestone 2.
        </p>
      </Card>
    </>
  );
}
