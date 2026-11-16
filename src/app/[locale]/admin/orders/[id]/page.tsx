import type { Metadata } from "next";
import Image from "next/image";
import { Download } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { notFound } from "next/navigation";
import { markPaid } from "@/actions/admin/orders";
import { ConfirmAction } from "@/components/admin/actions";
import { OrderForm } from "@/components/admin/order-form";
import { Card, PageHeader } from "@/components/admin/ui";
import { OrderStatus } from "@/components/order-status";
import { TotalsRows } from "@/components/store/summary";
import { buttonVariants } from "@/components/ui/button";
import { addressLines } from "@/lib/address";
import { COLORS, isPrinted, readOrderDesign, type ColorKey } from "@/lib/customization";
import { PRINT_ZONES, printPixels } from "@/lib/customizer/layout";
import { db } from "@/lib/db";
import { formatDate, formatDateTime, formatPrice } from "@/lib/format";
import { itemFile, type ItemFile } from "@/lib/order-files";
import { isMobileMoney, OPERATOR_NAME, paymentState } from "@/lib/payment";
import { getSettings } from "@/lib/settings";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.order");
  return { title: t("metaTitle") };
}

/** Pastille de couleur suivie de son nom : la teinte seule ne suffit pas à la lire. */
function Swatch({ color, name }: { color: ColorKey; name: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span aria-hidden className="size-3.5 shrink-0 rounded-full border border-foreground/25" style={{ background: COLORS[color] }} />
      {name}
    </span>
  );
}

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [order, { currency }, locale, t, tc, tp, colorName, fontName] = await Promise.all([
    // Articles triés par identifiant : la route de téléchargement numérote les fichiers dans le même ordre.
    db.order.findUnique({ where: { id }, include: { items: { orderBy: { id: "asc" } }, user: { select: { id: true, name: true } } } }),
    getSettings(),
    getLocale(),
    getTranslations("admin.order"),
    getTranslations("admin.customization"),
    getTranslations("payment"),
    getTranslations("customizer.colors"),
    getTranslations("customizer.fonts"),
  ]);
  if (!order) notFound();
  const payment = paymentState(order);
  const price = (cents: number) => formatPrice(cents, currency, locale);
  const method = isMobileMoney(order.paymentMethod) ? OPERATOR_NAME[order.paymentMethod] : order.paymentMethod === "COD" ? tp("cod") : order.paymentMethod;
  const reference = (chunks: React.ReactNode) => <span className="font-mono text-foreground">{chunks}</span>;
  const download = (itemId: string, kind: ItemFile) => `/api/admin/orders/${order.id}/items/${itemId}/${kind}`;

  return (
    <>
      <PageHeader title={t("title", { number: order.number })} description={t("placed", { date: formatDateTime(order.createdAt, locale) })} back={{ href: "/admin/orders", label: t("back") }}>
        <OrderStatus status={order.status} />
      </PageHeader>
      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="grid min-w-0 content-start gap-4">
          <Card title={t("items", { count: order.items.reduce((s, i) => s + i.quantity, 0) })} flush>
            <ul className="divide-y border-t">
              {order.items.map((item) => {
                const name = item.productId ? (
                  <Link href={`/admin/products/${item.productId}`} className="text-sm font-medium underline-offset-4 hover:underline">{item.name}</Link>
                ) : (
                  <p className="text-sm font-medium">{item.name}</p>
                );
                const quantity = <p className="text-[0.8125rem] text-muted-foreground tabular-nums">{item.quantity} × {price(item.priceCents)}</p>;
                const total = <p className="text-sm font-medium tabular-nums">{price(item.quantity * item.priceCents)}</p>;
                const custom = readOrderDesign(item.customization);

                if (!custom)
                  return (
                    <li key={item.id} data-item={item.id} className="flex items-center gap-4 px-5 py-3">
                      <div className="relative size-12 shrink-0 overflow-hidden rounded-md bg-muted">{item.imageUrl && <Image src={item.imageUrl} alt="" fill sizes="48px" className="object-cover" />}</div>
                      <div className="min-w-0 flex-1">
                        {name}
                        {quantity}
                      </div>
                      {total}
                    </li>
                  );

                const { template, design } = custom;
                const printed = isPrinted(design);
                const zone = PRINT_ZONES[template];
                const pixels = printPixels(template);
                const files = (["print", "image"] as const).filter((kind) => itemFile(item, kind));
                const nameId = `article-${item.id}`;
                return (
                  <li key={item.id} data-item={item.id} data-customized className="grid gap-4 px-5 py-4 sm:grid-cols-[13rem_minmax(0,1fr)]">
                    <div className="relative aspect-square w-full max-w-64 overflow-hidden rounded-md border bg-muted">
                      {item.imageUrl && <Image src={item.imageUrl} alt={t("custom.preview", { template: tc(`templates.${template}`), color: colorName(design.color) })} fill sizes="(min-width: 640px) 208px, 256px" className="object-contain" />}
                    </div>
                    <div className="grid min-w-0 content-start gap-3">
                      <div className="flex items-start justify-between gap-4">
                        <div id={nameId} className="min-w-0">
                          {name}
                          {quantity}
                        </div>
                        {total}
                      </div>
                      <dl className="grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-[auto_minmax(0,1fr)] *:min-w-0 [&_dd]:mb-1 sm:[&_dd]:mb-0 [&_dt]:text-muted-foreground">
                        <dt>{t("custom.template")}</dt>
                        <dd>{tc(`templates.${template}`)}</dd>
                        <dt>{t("custom.color")}</dt>
                        <dd><Swatch color={design.color} name={colorName(design.color)} /></dd>
                        {design.text && (
                          <>
                            <dt>{t("custom.text")}</dt>
                            <dd>
                              <span data-print-text className="rounded-sm bg-muted px-1.5 py-0.5 text-[0.9375rem] font-medium whitespace-pre-wrap [overflow-wrap:anywhere]">{design.text}</span>
                            </dd>
                            <dt>{t("custom.font")}</dt>
                            <dd>{fontName(design.font)}</dd>
                            <dt>{t("custom.ink")}</dt>
                            <dd><Swatch color={design.ink} name={colorName(design.ink)} /></dd>
                          </>
                        )}
                        {design.image && (
                          <>
                            <dt>{t("custom.image")}</dt>
                            <dd>{t("custom.imageSent")}</dd>
                          </>
                        )}
                        {printed && (
                          <>
                            <dt>{t("custom.zone")}</dt>
                            <dd className="tabular-nums">{t("custom.zoneSize", zone)}</dd>
                            <dt>{t("custom.file")}</dt>
                            <dd className="tabular-nums">{t("custom.fileSize", pixels)}</dd>
                          </>
                        )}
                      </dl>
                      {printed ? (
                        files.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {files.map((kind) => (
                              // Simple lien : la route est hors des pages traduites, le Link de next-intl y ajouterait la langue.
                              <a key={kind} href={download(item.id, kind)} download aria-describedby={nameId} className={buttonVariants({ variant: "outline", size: "md" })}>
                                <Download aria-hidden />
                                {kind === "print" ? t("custom.downloadPrint") : t("custom.downloadImage")}
                              </a>
                            ))}
                          </div>
                        )
                      ) : (
                        <p className="text-sm text-muted-foreground">{t("custom.colorOnly")}</p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="border-t px-5 py-5 sm:ml-auto sm:max-w-xs">
              <TotalsRows subtotalCents={order.subtotalCents} discountCents={order.discountCents} promoCode={order.promoCode} shippingCents={order.shippingCents} totalCents={order.totalCents} currency={currency} />
            </div>
          </Card>
          {order.note && (
            <Card title={t("note")}>
              <p className="text-sm leading-relaxed whitespace-pre-line">{order.note}</p>
            </Card>
          )}
        </div>
        <div className="grid min-w-0 content-start gap-4">
          <Card title={t("processing")}>
            <OrderForm id={order.id} status={order.status} trackingNumber={order.trackingNumber} unpaid={payment === "awaiting" || payment === "declared"} />
          </Card>
          <Card title={t("payment")}>
            <div className="grid gap-3 text-sm">
              <p className="font-medium">
                {method}
                <span className="font-normal text-muted-foreground">, {price(order.totalCents)}</span>
              </p>
              {payment === "awaiting" && <p className="text-muted-foreground">{t("awaiting")}</p>}
              {payment === "declared" && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">{t("declaredReference")}</p>
                  <p className="mt-1 font-mono text-base break-all">{order.paymentReference}</p>
                  {order.paymentDeclaredAt && <p className="text-muted-foreground">{t("declaredAt", { date: formatDateTime(order.paymentDeclaredAt, locale) })}</p>}
                  <p className="mt-2 text-muted-foreground">{t("declaredCheck")}</p>
                </div>
              )}
              {payment === "received" && (
                <p className="text-muted-foreground">
                  {isMobileMoney(order.paymentMethod)
                    ? order.paidAt ? t("receivedMobile", { date: formatDateTime(order.paidAt, locale) }) : t("receivedMobileNoDate")
                    : order.paidAt ? t("receivedCod", { date: formatDateTime(order.paidAt, locale) }) : t("receivedCodNoDate")}
                  {order.paymentReference && <> {t.rich("reference", { reference: order.paymentReference, ref: reference })}</>}
                </p>
              )}
              {payment === "onDelivery" && <p className="text-muted-foreground">{t("onDelivery")}</p>}
              {payment === "void" && <p className="text-muted-foreground">{order.paymentReference ? t.rich("closedWithReference", { reference: order.paymentReference, ref: reference }) : t("closed")}</p>}
              {(payment === "awaiting" || payment === "declared") && (
                <ConfirmAction
                  action={markPaid.bind(null, order.id)}
                  title={t("confirmTitle")}
                  description={t("confirmDescription", { amount: price(order.totalCents), method })}
                  confirmLabel={t("markPaid")}
                  cancelLabel={t("cancel")}
                  variant={payment === "declared" ? "default" : "outline"}
                  size="md"
                  danger={false}
                >
                  {t("markPaid")}
                </ConfirmAction>
              )}
            </div>
          </Card>
          <Card title={t("customer")}>
            <div className="grid gap-4 text-sm">
              <div>
                {order.user ? (
                  <Link href={`/admin/customers/${order.user.id}`} className="font-medium underline-offset-4 hover:underline">{order.user.name}</Link>
                ) : (
                  <p className="font-medium">{order.fullName} <span className="font-normal text-muted-foreground">{t("guest")}</span></p>
                )}
                <p><a href={`mailto:${order.email}`} className="text-muted-foreground underline-offset-4 break-all hover:underline">{order.email}</a></p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">{t("address")}</p>
                <address className="mt-1 leading-relaxed not-italic">
                  {addressLines(order).map((line) => (
                    <span key={line} className="block">{line}</span>
                  ))}
                </address>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">{t("zone")}</p>
                <p className="mt-1">{order.shippingZone}</p>
                {order.estimatedDelivery && <p className="text-muted-foreground">{t("promised", { date: formatDate(order.estimatedDelivery, locale, "weekday") })}</p>}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
