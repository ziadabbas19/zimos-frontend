"use client";

/* eslint-disable @next/next/no-img-element -- the captures are already sized and compressed for the page. */
import { useId, useState } from "react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionary";
import { shareOf } from "@/lib/amounts";
import { JOURNEY_LOOK, deskShot } from "@/lib/store-shots";
import { ColorIcon } from "./color-icon";
import { Check } from "./duo-icons";

import { SectionLabel } from "./section-label";

const two = (n: number) => String(n).padStart(2, "0");

/**
 * An order's road on the night-blue panel, from the ad that brought it to
 * the profit it left: five steps down one side, and beside them a drawing of
 * the screen each one happens on — the ad on a phone, the sales page, the
 * confirmation queue, the shipment, the sum. The steps play one after the
 * other by themselves: the open step's line fills, and when it is full the
 * next one opens (the line is a CSS animation, so it holds still while the
 * section is off screen and never starts under reduced motion). Choosing a
 * step stops the play there. Each step is a button that opens its own
 * paragraph; the drawings are decoration, and the words say the same.
 */
export function OrderJourney({ copy, locale }: { copy: Dictionary["journey"]; locale: Locale }) {
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(true);
  const baseId = useId();
  const { steps, demo } = copy;
  const shot = deskShot(JOURNEY_LOOK, locale);

  const pick = (to: number) => {
    setPlaying(false);
    setStep(to);
  };

  return (
    <section className="zx-sec zx-sec--night" id="how" aria-labelledby="zx-how" data-section="journey">
      <div className="zx-night">
        <div className="lz-in">
          <header className="zx-head zx-head--center lz-r">
            <SectionLabel n="04" text={copy.kicker} />
            <h2 className="zx-h2" id="zx-how">
              {copy.heading}
            </h2>
            <p className="zx-lede">{copy.intro}</p>
          </header>

          <div className="zx-journey lz-r">
            <ol className="zx-jsteps">
              {steps.map((item, i) => {
                const open = i === step;
                return (
                  <li key={item.id} className={open ? "zx-jstep is-open" : "zx-jstep"}>
                    <button type="button" aria-expanded={open} aria-controls={`${baseId}-${item.id}`} onClick={() => pick(i)}>
                      <span className="zx-jstep__n ltr" aria-hidden>
                        {two(i + 1)}
                      </span>
                      <span className="zx-jstep__words">
                        <small>{item.label}</small>
                        <b>{item.title}</b>
                      </span>
                    </button>
                    <p className="zx-jstep__body" id={`${baseId}-${item.id}`} hidden={!open}>
                      {item.body}
                    </p>
                    {open ? (
                      <i
                        className={playing ? "zx-jstep__line is-playing" : "zx-jstep__line"}
                        aria-hidden
                        onAnimationEnd={() => setStep((at) => (at + 1) % steps.length)}
                      />
                    ) : null}
                  </li>
                );
              })}
            </ol>

            <div className="zx-jstage" aria-hidden>
              <div className="zx-jstage__glow" />

              {/* 1 — the ad, on a phone. */}
              <div className="zx-mock zx-mphone" hidden={step !== 0}>
                <div className="zx-ad__head">
                  <i>
                    <ColorIcon name="store" size={16} fill />
                  </i>
                  <span>
                    <b>{demo.storeName}</b>
                    <small>{demo.sponsored}</small>
                  </span>
                </div>
                <p className="zx-ad__text">{demo.adText}</p>
                <div className="zx-ad__media">
                  <img src={shot} width={960} height={900} alt="" loading="lazy" decoding="async" />
                </div>
                <div className="zx-ad__cta">
                  <span>
                    <b>{demo.product}</b>
                    <small className="ltr">yourstore.zimos.co</small>
                  </span>
                  <em>{demo.shopNow}</em>
                </div>
              </div>

              {/* 2 — the sales page it opens. */}
              <div className="zx-mock zx-mphone" hidden={step !== 1}>
                <div className="zx-page__top">
                  <b>{demo.storeName}</b>
                  <small className="ltr">yourstore.zimos.co</small>
                </div>
                <div className="zx-ad__media zx-ad__media--short">
                  <img src={shot} width={960} height={900} alt="" loading="lazy" decoding="async" />
                </div>
                <div className="zx-page__title">
                  <b>{demo.product}</b>
                  <em>{demo.price}</em>
                </div>
                <div className="zx-page__form">
                  {demo.fields.map((field) => (
                    <span key={field}>{field}</span>
                  ))}
                </div>
                <div className="zx-page__bump">
                  <i>
                    <Check size={10} />
                  </i>
                  {demo.bump}
                </div>
                <div className="zx-page__go">{demo.orderNow}</div>
              </div>

              {/* 3 — the confirmation queue. */}
              <div className="zx-mock zx-mcard" hidden={step !== 2}>
                <div className="zx-mcard__head">
                  <span>
                    <ColorIcon name="call" size={16} fill />
                    {demo.queue}
                  </span>
                  <em className="zx-mpill zx-mpill--ok">{demo.risk}</em>
                </div>
                <div className="zx-order">
                  <div>
                    <b>{demo.orderNumber}</b>
                    <small>{demo.product}</small>
                  </div>
                  <em>{demo.price}</em>
                </div>
                <div className="zx-order__lines">
                  <u />
                  <u />
                </div>
                <div className="zx-order__acts">
                  <span className="is-go">
                    <Check size={12} />
                    {demo.confirmed}
                  </span>
                  <span>{demo.refused}</span>
                  <span>{demo.later}</span>
                </div>
              </div>

              {/* 4 — the shipment. */}
              <div className="zx-mock zx-mcard" hidden={step !== 3}>
                <div className="zx-mcard__head">
                  <span>
                    <ColorIcon name="truck" size={16} fill />
                    {demo.shipment}
                  </span>
                  <em className="zx-mpill">{demo.orderNumber}</em>
                </div>
                <div className="zx-ship__code">
                  <small>{demo.tracking}</small>
                  <b className="ltr">ZM-4821-3907</b>
                </div>
                <ol className="zx-ship__road">
                  {demo.statuses.map((status, i) => (
                    <li key={status} className={i < 2 ? "is-done" : "is-next"}>
                      <i>{i < 2 ? <Check size={11} /> : null}</i>
                      {status}
                    </li>
                  ))}
                </ol>
              </div>

              {/* 5 — what the order left. */}
              <div className="zx-mock zx-mcard" hidden={step !== 4}>
                <div className="zx-mcard__head">
                  <span>
                    <ColorIcon name="wallet" size={16} fill />
                    {demo.profitTitle}
                  </span>
                  <em className="zx-mpill">{demo.orderNumber}</em>
                </div>
                <div className="zx-sum zx-sum--night">
                  {demo.rows.map((row, i) => (
                    <div key={row.label} className={i === 0 ? "zx-sum__row is-whole" : "zx-sum__row"} style={shareOf(row, demo.rows[0])}>
                      <span>{row.label}</span>
                      <b className="ltr">{row.value}</b>
                      <i />
                    </div>
                  ))}
                  <div className="zx-sum__net">
                    <span>{demo.net.label}</span>
                    <b>
                      <span className="ltr">{demo.net.value}</span> <small>{demo.currency}</small>
                    </b>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <p className="zx-cap zx-cap--night">{copy.note}</p>
        </div>
      </div>
    </section>
  );
}
