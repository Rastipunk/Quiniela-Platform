"use client";

import { useState } from "react";

interface FAQItem {
  question: string;
  answer: string;
  category: string;
}

interface FAQAccordionProps {
  faqData: FAQItem[];
}

export function FAQAccordion({ faqData }: FAQAccordionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("Todos");

  const categories = [
    "Todos",
    ...Array.from(new Set(faqData.map((item) => item.category))),
  ];

  const filteredFAQ =
    selectedCategory === "Todos"
      ? faqData
      : faqData.filter((item) => item.category === selectedCategory);

  return (
    <>
      {/* Category Filter */}
      <section
        style={{
          padding: "32px 40px",
          maxWidth: 900,
          margin: "0 auto",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => {
                setSelectedCategory(category);
                setOpenIndex(null);
              }}
              style={{
                padding: "10px 20px",
                borderRadius: 20,
                border: "none",
                background:
                  selectedCategory === category
                    ? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
                    : "var(--surface)",
                color:
                  selectedCategory === category ? "white" : "var(--text)",
                fontSize: "0.95rem",
                fontWeight: selectedCategory === category ? 600 : 400,
                cursor: "pointer",
                transition: "all 0.2s ease",
                boxShadow:
                  selectedCategory === category
                    ? "0 2px 8px rgba(102, 126, 234, 0.3)"
                    : "none",
              }}
            >
              {category}
            </button>
          ))}
        </div>
      </section>

      {/* FAQ Items */}
      <section
        style={{
          padding: "0 40px 80px",
          maxWidth: 900,
          margin: "0 auto",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filteredFAQ.map((item) => {
            const globalIndex = faqData.indexOf(item);
            const isOpen = openIndex === globalIndex;

            return (
              <div
                key={globalIndex}
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                  overflow: "hidden",
                  transition: "box-shadow 0.2s ease",
                  boxShadow: isOpen
                    ? "0 4px 12px rgba(0,0,0,0.1)"
                    : "none",
                }}
              >
                <button
                  onClick={() => setOpenIndex(isOpen ? null : globalIndex)}
                  aria-expanded={isOpen}
                  style={{
                    width: "100%",
                    padding: "20px",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 16,
                    textAlign: "left",
                  }}
                >
                  <span
                    style={{
                      fontSize: "1rem",
                      fontWeight: 600,
                      color: "var(--text)",
                      flex: 1,
                    }}
                  >
                    {item.question}
                  </span>
                  <span
                    style={{
                      fontSize: "1.25rem",
                      color: "var(--muted)",
                      transform: isOpen ? "rotate(180deg)" : "rotate(0)",
                      transition: "transform 0.2s ease",
                      flexShrink: 0,
                    }}
                  >
                    {"▼"}
                  </span>
                </button>

                {isOpen && (
                  <div
                    style={{
                      padding: "0 20px 20px",
                      borderTop: "1px solid var(--border)",
                      paddingTop: 16,
                    }}
                  >
                    <p
                      style={{
                        color: "var(--muted)",
                        lineHeight: 1.7,
                        margin: 0,
                        fontSize: "0.95rem",
                      }}
                    >
                      {item.answer}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}
