import { DealForm } from "@/components/deals/deal-form";

export default function NewDealPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Submit New Deal</h1>
        <p className="text-muted-foreground">
          Enter the details of your new policy sale.
        </p>
      </div>
      <DealForm />
    </div>
  );
}
