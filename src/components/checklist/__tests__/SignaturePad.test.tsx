/**
 * SignaturePad — canvas rendering, clear, isEmpty
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { createRef } from "react";
import { SignaturePad, type SignaturePadRef } from "@/components/checklist/SignaturePad";

// Mock react-signature-canvas
const mockClear = vi.fn();
const mockIsEmpty = vi.fn(() => true);
const mockGetTrimmedCanvas = vi.fn(() => ({
  toDataURL: vi.fn(() => "data:image/png;base64,mockSignature"),
}));

vi.mock("react-signature-canvas", () => {
  const React = require("react");
  return {
    default: React.forwardRef((props: any, ref: any) => {
      React.useImperativeHandle(ref, () => ({
        clear: mockClear,
        isEmpty: mockIsEmpty,
        getTrimmedCanvas: mockGetTrimmedCanvas,
      }));
      return (
        <canvas
          data-testid="signature-canvas"
          className={props.canvasProps?.className}
          onMouseUp={() => props.onEnd?.()}
        />
      );
    }),
  };
});

describe("SignaturePad", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsEmpty.mockReturnValue(true);
  });

  it("renderiza label corretamente", () => {
    render(<SignaturePad label="Assinatura do Cliente" />);
    expect(screen.getByText("Assinatura do Cliente")).toBeInTheDocument();
  });

  it("renderiza canvas de assinatura", () => {
    render(<SignaturePad label="Assinatura" />);
    expect(screen.getByTestId("signature-canvas")).toBeInTheDocument();
  });

  it("renderiza botão Limpar", () => {
    render(<SignaturePad label="Assinatura" />);
    expect(screen.getByText("Limpar")).toBeInTheDocument();
  });

  it("chama clear e onSignatureChange(null) ao clicar Limpar", () => {
    const onChange = vi.fn();
    render(<SignaturePad label="Assinatura" onSignatureChange={onChange} />);
    fireEvent.click(screen.getByText("Limpar"));
    expect(mockClear).toHaveBeenCalled();
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("expõe ref com isEmpty()", () => {
    const ref = createRef<SignaturePadRef>();
    render(<SignaturePad ref={ref} label="Assinatura" />);
    expect(ref.current?.isEmpty()).toBe(true);
  });

  it("expõe ref com getSignatureDataUrl() null quando vazio", () => {
    const ref = createRef<SignaturePadRef>();
    render(<SignaturePad ref={ref} label="Assinatura" />);
    expect(ref.current?.getSignatureDataUrl()).toBeNull();
  });

  it("retorna dataUrl quando não vazio", () => {
    mockIsEmpty.mockReturnValue(false);
    const ref = createRef<SignaturePadRef>();
    render(<SignaturePad ref={ref} label="Assinatura" />);
    expect(ref.current?.getSignatureDataUrl()).toBe("data:image/png;base64,mockSignature");
  });

  it("chama onSignatureChange com dataUrl ao assinar", () => {
    mockIsEmpty.mockReturnValue(false);
    const onChange = vi.fn();
    render(<SignaturePad label="Assinatura" onSignatureChange={onChange} />);
    // Simulate end of stroke
    fireEvent.mouseUp(screen.getByTestId("signature-canvas"));
    expect(onChange).toHaveBeenCalledWith("data:image/png;base64,mockSignature");
  });

  it("ref.clear() chama clear do canvas e onSignatureChange(null)", () => {
    const onChange = vi.fn();
    const ref = createRef<SignaturePadRef>();
    render(<SignaturePad ref={ref} label="Assinatura" onSignatureChange={onChange} />);
    ref.current?.clear();
    expect(mockClear).toHaveBeenCalled();
    expect(onChange).toHaveBeenCalledWith(null);
  });
});
