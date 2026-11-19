import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import { mergeMessages, type Messages } from "@/i18n/messages";
import en from "../../../messages/en.json";
import fr from "../../../messages/fr.json";
import mg from "../../../messages/mg.json";
import { availablePaymentMethods, checkMerchantNumber, isMobileMoney, merchantNumber, normalizePaymentReference, openOperators, operatorList, operatorOf, paymentState } from "../payment";

const numbers = { mvolaNumber: "034 00 123 45", orangeMoneyNumber: "032 00 123 45", airtelMoneyNumber: "" };

describe("availablePaymentMethods", () => {
  it("propose chaque opérateur dont le numéro marchand est renseigné, puis le paiement à la livraison", () => {
    expect(availablePaymentMethods(numbers)).toEqual(["MVOLA", "ORANGE_MONEY", "COD"]);
  });
  it("garde le paiement à la livraison quand aucun numéro n'est renseigné", () => {
    expect(availablePaymentMethods({ mvolaNumber: "", orangeMoneyNumber: " ", airtelMoneyNumber: "" })).toEqual(["COD"]);
  });
  it("ne propose plus la carte bancaire", () => {
    expect(availablePaymentMethods(numbers)).not.toContain("CARD");
  });
});

describe("openOperators", () => {
  it("garde les opérateurs proposés à la commande, dans le même ordre", () => {
    expect(openOperators(numbers)).toEqual(["MVOLA", "ORANGE_MONEY"]);
  });
  it("n'en garde aucun quand aucun numéro n'est renseigné : seul le paiement à la livraison reste", () => {
    expect(openOperators({ mvolaNumber: "", orangeMoneyNumber: " ", airtelMoneyNumber: "" })).toEqual([]);
  });
});

describe("operatorList (message payment.operators)", () => {
  // Même socle et même moteur ICU que l'application (src/i18n/request.ts).
  const say = (locale: "fr" | "en" | "mg", operators: Parameters<typeof operatorList>[0]) => {
    const messages: Messages = locale === "fr" ? fr : mergeMessages(fr, { en, mg }[locale]);
    const t = createTranslator({ locale, messages }) as unknown as (key: string, values: Record<string, string | number>) => string;
    return t("payment.operators", operatorList(operators));
  };
  const cases = {
    fr: ["MVola", "MVola ou Airtel Money", "MVola, Orange Money ou Airtel Money"],
    en: ["MVola", "MVola or Airtel Money", "MVola, Orange Money or Airtel Money"],
    mg: ["MVola", "MVola na Airtel Money", "MVola, Orange Money na Airtel Money"],
  } as const;
  for (const [locale, [one, two, three]] of Object.entries(cases) as [keyof typeof cases, readonly string[]][]) {
    it(`met un, deux ou trois opérateurs en liste en ${locale}`, () => {
      expect(say(locale, ["MVOLA"])).toBe(one);
      expect(say(locale, ["MVOLA", "AIRTEL_MONEY"])).toBe(two);
      expect(say(locale, ["MVOLA", "ORANGE_MONEY", "AIRTEL_MONEY"])).toBe(three);
    });
  }
});

describe("merchantNumber", () => {
  it("donne le numéro à créditer pour l'opérateur choisi", () => {
    expect(merchantNumber("MVOLA", numbers)).toBe("034 00 123 45");
    expect(merchantNumber("ORANGE_MONEY", numbers)).toBe("032 00 123 45");
    expect(merchantNumber("COD", numbers)).toBe("");
  });
});

describe("operatorOf", () => {
  it("reconnaît l'opérateur d'un numéro à son préfixe", () => {
    expect(operatorOf("034 00 123 45")).toBe("MVOLA");
    expect(operatorOf("038 00 123 45")).toBe("MVOLA");
    expect(operatorOf("032 00 123 45")).toBe("ORANGE_MONEY");
    expect(operatorOf("037 00 123 45")).toBe("ORANGE_MONEY");
    expect(operatorOf("033 00 123 45")).toBe("AIRTEL_MONEY");
  });
  it("ne reconnaît ni un fixe ni un numéro mal formé", () => {
    expect(operatorOf("020 22 123 45")).toBeNull();
    expect(operatorOf("abc")).toBeNull();
  });
});

describe("normalizePaymentReference", () => {
  it("retire les espaces autour et met en majuscules", () => {
    expect(normalizePaymentReference("  pp240101.1234.a12345 ")).toBe("PP240101.1234.A12345");
    expect(normalizePaymentReference("1234567890")).toBe("1234567890");
  });
  it("refuse une référence vide, trop courte, trop longue ou avec des caractères inattendus", () => {
    for (const input of ["", "   ", "123", "x".repeat(41), "ref<script>", "réf 12345", "12 34 56"]) expect(normalizePaymentReference(input), input).toBeNull();
  });
});

describe("paymentState", () => {
  const order = { paymentMethod: "MVOLA", status: "PENDING", paymentReference: null as string | null };
  it("attend le paiement tant que le client n'a pas donné de référence", () => {
    expect(paymentState(order)).toBe("awaiting");
  });
  it("reste à vérifier, et la commande en attente, une fois la référence déclarée", () => {
    expect(paymentState({ ...order, paymentReference: "1234567890" })).toBe("declared");
  });
  it("est reçu quand le vendeur a confirmé, même si la commande est déjà expédiée ou livrée", () => {
    for (const status of ["PAID", "SHIPPED", "DELIVERED"]) expect(paymentState({ ...order, status, paymentReference: "1234567890" })).toBe("received");
  });
  it("n'attend plus rien d'une commande annulée ou remboursée", () => {
    expect(paymentState({ ...order, status: "CANCELLED" })).toBe("void");
    expect(paymentState({ ...order, status: "REFUNDED" })).toBe("void");
  });
  it("à la livraison : dû au livreur jusqu'à la remise du colis", () => {
    expect(paymentState({ paymentMethod: "COD", status: "PENDING", paymentReference: null })).toBe("onDelivery");
    expect(paymentState({ paymentMethod: "COD", status: "SHIPPED", paymentReference: null })).toBe("onDelivery");
    expect(paymentState({ paymentMethod: "COD", status: "DELIVERED", paymentReference: null })).toBe("received");
  });
});

describe("isMobileMoney", () => {
  it("distingue les trois opérateurs du paiement à la livraison", () => {
    expect(["MVOLA", "ORANGE_MONEY", "AIRTEL_MONEY", "COD", "CARD"].map(isMobileMoney)).toEqual([true, true, true, false, false]);
  });
});

describe("checkMerchantNumber (réglages du vendeur)", () => {
  it("accepte un numéro vide : l'opérateur n'est simplement pas proposé", () => {
    expect(checkMerchantNumber("MVOLA", "  ")).toEqual({ ok: true, value: "" });
  });
  it("normalise un numéro du bon réseau", () => {
    expect(checkMerchantNumber("MVOLA", "+261 38 00 123 45")).toEqual({ ok: true, value: "038 00 123 45" });
    expect(checkMerchantNumber("AIRTEL_MONEY", "0330012345")).toEqual({ ok: true, value: "033 00 123 45" });
  });
  it("refuse un numéro d'un autre réseau : le client enverrait l'argent dans le vide", () => {
    expect(checkMerchantNumber("MVOLA", "032 00 123 45")).toEqual({ ok: false, reason: "wrongOperator" });
    expect(checkMerchantNumber("ORANGE_MONEY", "034 00 123 45")).toEqual({ ok: false, reason: "wrongOperator" });
  });
  it("refuse un numéro illisible", () => {
    expect(checkMerchantNumber("MVOLA", "034 00 12")).toEqual({ ok: false, reason: "invalid" });
  });
});
