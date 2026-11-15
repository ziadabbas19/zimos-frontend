"use client";

/* eslint-disable @next/next/no-img-element -- the captures are already sized and compressed for the page. */
import { useId, useState, type CSSProperties } from "react";
import type { Dictionary } from "@/i18n/dictionary";
import { JOURNEY_SHOT } from "@/lib/store-shots";
import { ChartBar, Check, House, Package, User } from "./duo-icons";
import { SectionLabel } from "./section-label";

const two = (n: number) => String(n).padStart(2, "0");
const kth = (k: number) => ({ "--k": k }) as CSSProperties;

/** The week's profit, day by day, as each bar's height (an example's figures). */
const WEEK = [38, 52, 44, 66, 58, 82, 96];

/** How long each step stays open while the journey plays by itself. */
const STEP_MS = 6500;

/**
 * An order's road on the panel that follows the theme (light blue by day,
 * night blue by night), from the ad that brought it to the profit it left:
 * five steps down one side, and beside them a phone showing the screen each
 * one happens on — the ad, the sales page, the confirmation queue with its
 * counts and the orders waiting, the shipment with its courier, its address
 * and its road, the sum with the week's chart — drawn in HTML, animated in
 * CSS, over the phone's own tab bar.
 *
 * The steps play one after the other by themselves: the open step's line
 * fills, and when it is full the next one opens. The line is a CSS
 * animation, so it holds while the pointer or the focus is on the list or
 * the section is off screen, and never starts under reduced motion.
 * Choosing a step stops the play there. Each step is a button that opens
 * its own paragraph; the phone is decoration, and the words say the same.
 */
export function OrderJourney({ copy }: { copy: Dictionary["journey"] }) {
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(true);
  const baseId = useId();
  const { steps, demo } = copy;

  return (
    <section className="zm-night zm-sec" id="how" aria-labelledby="zm-how" data-section="journey">
      <div className="zm-in">
        <header className="zm-sh rv">
          <SectionLabel n="04" text={copy.kicker} />
          <h2 id="zm-how">{copy.heading}</h2>
          <p>{copy.intro}</p>
        </header>

        <div className="zm-jgrid">
          <ol className={playing ? "zm-jlist" : "zm-jlist is-held"} style={{ "--dur": `${STEP_MS}ms` } as CSSProperties}>
            {steps.map((item, i) => {
              const open = i === step;
              return (
                <li key={item.id} className={open ? "zm-js on" : "zm-js"}>
                  {open && playing ? <i key={step} className="bar" aria-hidden onAnimationEnd={() => setStep((at) => (at + 1) % steps.length)} /> : null}
                  <button
                    type="button"
                    aria-expanded={open}
                    aria-controls={`${baseId}-${item.id}`}
                    onClick={() => {
                      setPlaying(false);
                      setStep(i);
                    }}
                  >
                    <span className="n ltr" aria-hidden>
                      {two(i + 1)}
                    </span>
                    <span>
                      <small>{item.label}</small>
                      <b>{item.title}</b>
                    </span>
                  </button>
                  <p id={`${baseId}-${item.id}`} hidden={!open}>
                    {item.body}
                  </p>
                </li>
              );
            })}
          </ol>

          <div className="zm-jstage rv" aria-hidden>
            <div className="zm-jph">
              <Demo step={step} demo={demo} />
              <div className="zm-tabbar">
                <i className="on">
                  <House size={16} />
                </i>
                <i>
                  <Package size={16} />
                </i>
                <i>
                  <ChartBar size={16} />
                </i>
                <i>
                  <User size={16} />
                </i>
              </div>
            </div>
          </div>
        </div>

        <p className="zm-cap">{copy.note}</p>
      </div>
    </section>
  );
}

function Demo({ step, demo }: { step: number; demo: Dictionary["journey"]["demo"] }) {
  if (step === 0) {
    return (
      <div className="zm-jin" key="ad">
        <div className="who">
          <i />
          <span>
            <b>{demo.storeName}</b>
            <small>{demo.sponsored}</small>
          </span>
        </div>
        <p>{demo.adText}</p>
        <div className="img">
          <img src={JOURNEY_SHOT} width={960} height={900} alt="" loading="lazy" decoding="async" />
        </div>
        <div className="cta">
          <span>
            <b>{demo.product}</b>
            <br />
            <span className="site ltr">yourstore.zimos.co</span>
          </span>
          <em>{demo.shopNow}</em>
        </div>
      </div>
    );
  }
  if (step === 1) {
    return (
      <div className="zm-jin" key="page">
        <div className="img img--short">
          <img src={JOURNEY_SHOT} width={960} height={900} alt="" loading="lazy" decoding="async" />
        </div>
        <div className="row title">
          <span>{demo.product}</span>
          <span>{demo.price}</span>
        </div>
        {demo.fields.map((field, k) => (
          <div key={field} className="zm-fld" style={kth(k)}>
            {field}
          </div>
        ))}
        <div className="zm-bump">
          <i>
            <Check size={10} />
          </i>
          {demo.bump}
        </div>
        <div className="zm-order">{demo.orderNow}</div>
      </div>
    );
  }
  if (step === 2) {
    return (
      <div className="zm-jin zm-jin--queue" key="confirm">
        <b className="title">{demo.queue}</b>
        <div className="zm-qcount">
          {demo.counts.map((count) => (
            <span key={count.label}>
              <b className="ltr">{count.value}</b>
              {count.label}
            </span>
          ))}
        </div>
        <div className="zm-q">
          <div className="row">
            <b>{demo.orderNumber}</b>
            <em className="zm-risk">{demo.risk}</em>
          </div>
          <div className="row soft">
            <span>{demo.product}</span>
            <span>{demo.price}</span>
          </div>
          <div className="zm-acts">
            <span className="ok">{demo.confirmed}</span>
            <span>{demo.refused}</span>
            <span>{demo.later}</span>
          </div>
        </div>
        {demo.nextOrders.map((order, k) => (
          <div key={order.number} className="zm-q zm-q--slim" style={kth(k)}>
            <div className="row">
              <b>{order.number}</b>
              <em className="zm-risk">{demo.risk}</em>
            </div>
            <div className="row soft">
              <span>{order.item}</span>
              <span>{order.total}</span>
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (step === 3) {
    return (
      <div className="zm-jin" key="ship">
        <b className="title">{demo.shipment}</b>
        <div>
          {[demo.courier, demo.collect, demo.deliverTo].map((line) => (
            <div key={line.label} className="zm-kv">
              <span>{line.label}</span>
              <b>{line.value}</b>
            </div>
          ))}
        </div>
        <span className="site">{demo.tracking}</span>
        <div className="zm-trk ltr">ZM-20481-EG</div>
        <ul className="zm-tl">
          {demo.statuses.map((status, k) => (
            <li key={status} style={kth(k)}>
              {status}
              <small>{demo.statusTimes[k]}</small>
            </li>
          ))}
        </ul>
        <div className="zm-kv">
          <span>{demo.expected.label}</span>
          <b>{demo.expected.value}</b>
        </div>
      </div>
    );
  }
  return (
    <div className="zm-jin" key="profit">
      <b className="title">{demo.profitTitle}</b>
      <div className="zm-pf">
        {demo.rows.map((row, k) => (
          <div key={row.label} className="row" style={kth(k)}>
            <span>{row.label}</span>
            <b className="ltr">{row.value}</b>
          </div>
        ))}
        <div className="net">
          <span>{demo.net.label}</span>
          <strong>
            <span className="ltr">{demo.net.value}</span> <small>{demo.currency}</small>
          </strong>
        </div>
      </div>
      <div className="zm-bars">
        {WEEK.map((height, k) => (
          <i key={k} style={{ "--h": `${height}%`, "--k": k } as CSSProperties} />
        ))}
      </div>
      <div className="zm-kv">
        <span>{demo.week.label}</span>
        <b className="up ltr">{demo.week.value}</b>
      </div>
    </div>
  );
}
