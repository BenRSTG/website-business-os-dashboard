import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/domain/PageHeader";

export default function CustomersPage() {
  return (
    <>
      <PageHeader title="Customers" />
      <Card className="items-center px-4 py-12 text-center">
        <p className="font-medium">Noch keine Kunden</p>
        <p className="text-sm text-muted-foreground">
          Gewonnene Leads erscheinen hier, sobald die Kundenverwaltung in
          Milestone 6 steht.
        </p>
      </Card>
    </>
  );
}
