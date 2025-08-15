import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Address } from "viem";
import type { TokenInfo } from "@/config/tokens";

export function PaymentMethodSelect({
  tokens,
  value,
  onChange,
  disabled,
}: {
  tokens: TokenInfo[];
  value: Address;
  onChange: (addr: Address) => void;
  disabled?: boolean;
}) {
  return (
    <Select
      value={value}
      onValueChange={(v) => onChange(v as Address)}
      disabled={disabled}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Select token" />
      </SelectTrigger>
      <SelectContent>
        {tokens.map((t) => (
          <SelectItem key={t.address} value={t.address}>
            {t.symbol} {t.isNative ? "(native)" : ""}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export default PaymentMethodSelect;
