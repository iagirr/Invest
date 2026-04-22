import { z } from "zod";

const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;

export const transactionInputSchema = z.object({
  symbol: z
    .string()
    .trim()
    .min(1, "El simbolo es obligatorio")
    .transform((value) => value.toUpperCase()),
  name: z.string().trim().default(""),
  assetType: z.enum(["stock", "etf", "fund"]),
  operation: z.enum(["buy", "sell"]),
  quantity: z.coerce.number().positive("La cantidad debe ser positiva"),
  price: z.coerce.number().positive("El precio debe ser positivo"),
  fee: z.coerce.number().min(0, "La comision no puede ser negativa").default(0),
  currency: z
    .string()
    .trim()
    .min(3, "La divisa debe tener 3 letras")
    .max(3, "La divisa debe tener 3 letras")
    .transform((value) => value.toUpperCase()),
  fxRateToEur: z.coerce.number().positive("El cambio a EUR debe ser positivo").default(1),
  tradeDate: z.string().regex(isoDateRegex, "Fecha invalida"),
});

export const trackedInstrumentInputSchema = z.object({
  symbol: z
    .string()
    .trim()
    .min(1, "El simbolo es obligatorio")
    .transform((value) => value.toUpperCase()),
  name: z.string().trim().min(1, "El nombre es obligatorio"),
  assetType: z.enum(["stock", "etf", "fund"]),
  startDate: z.string().regex(isoDateRegex, "La fecha inicial no es valida"),
  startDatePrecision: z.enum(["exact", "estimated"]),
  endDate: z
    .string()
    .regex(isoDateRegex, "La fecha final no es valida")
    .optional()
    .or(z.literal("")),
  initialAmountEur: z.coerce.number().nonnegative("El capital inicial no puede ser negativo"),
  currentAmountEur: z.coerce.number().nonnegative("El capital actual no puede ser negativo"),
  totalReturnPercent: z.coerce
    .number()
    .gt(-100, "La rentabilidad total debe ser mayor que -100%"),
  isActive: z.coerce.boolean(),
  returnPrecision: z.enum(["exact", "estimated"]),
});

export const settingsInputSchema = z.object({
  benchmarkSymbol: z
    .string()
    .trim()
    .min(1, "El benchmark es obligatorio")
    .transform((value) => value.toUpperCase()),
});

export const contributionInputSchema = z.object({
  trackedInstrumentId: z.coerce.number().int().positive("El instrumento es obligatorio"),
  flowType: z.enum(["contribution", "withdrawal"]),
  amountEur: z.coerce.number().positive("El importe debe ser positivo"),
  flowDate: z.string().regex(isoDateRegex, "La fecha no es valida"),
});

export type TransactionInput = z.infer<typeof transactionInputSchema>;
export type TrackedInstrumentInput = z.infer<typeof trackedInstrumentInputSchema>;
export type SettingsInput = z.infer<typeof settingsInputSchema>;
export type ContributionInput = z.infer<typeof contributionInputSchema>;
