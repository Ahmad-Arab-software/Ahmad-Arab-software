"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";
import { PipelineState, ClientInput, ScrapeResult, DesignDocument } from "@/types/pipeline";

interface PipelineContextValue {
  state: PipelineState;
  setClientInput: (input: ClientInput) => void;
  setScrapeResult: (result: ScrapeResult) => void;
  setDesignDocument: (doc: DesignDocument) => void;
  goTo: (step: PipelineState["step"]) => void;
  reset: () => void;
}

const initialState: PipelineState = {
  step: "intake",
  clientInput: {},
};

const PipelineContext = createContext<PipelineContextValue | null>(null);

export function PipelineProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PipelineState>(initialState);

  function setClientInput(input: ClientInput) {
    setState((s) => ({ ...s, clientInput: input }));
  }

  function setScrapeResult(result: ScrapeResult) {
    setState((s) => ({ ...s, scrapeResult: result }));
  }

  function setDesignDocument(doc: DesignDocument) {
    setState((s) => ({ ...s, designDocument: doc }));
  }

  function goTo(step: PipelineState["step"]) {
    setState((s) => ({ ...s, step }));
  }

  function reset() {
    setState(initialState);
  }

  return (
    <PipelineContext.Provider
      value={{ state, setClientInput, setScrapeResult, setDesignDocument, goTo, reset }}
    >
      {children}
    </PipelineContext.Provider>
  );
}

export function usePipeline(): PipelineContextValue {
  const ctx = useContext(PipelineContext);
  if (!ctx) throw new Error("usePipeline must be used within a PipelineProvider");
  return ctx;
}
