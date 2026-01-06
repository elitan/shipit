import { DomainSection } from "../_components/domain-section";
import { SslSection } from "../_components/ssl-section";

export default function DomainPage() {
  return (
    <div className="space-y-6">
      <DomainSection />
      <SslSection />
    </div>
  );
}
