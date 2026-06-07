import { RefObject, useState } from "react";

export function useReceiptDownload(ref: RefObject<HTMLElement | null>, filename = "receipt") {
  const [working, setWorking] = useState(false);

  const capture = async (): Promise<string> => {
    const { toPng } = await import("html-to-image");
    const el = ref.current;
    if (!el) throw new Error("Receipt element not found");
    return toPng(el, { pixelRatio: 2, backgroundColor: "#ffffff" });
  };

  const downloadImage = async () => {
    setWorking(true);
    try {
      const dataUrl = await capture();
      const link = document.createElement("a");
      link.download = `${filename}.png`;
      link.href = dataUrl;
      link.click();
    } finally { setWorking(false); }
  };

  const downloadPDF = async () => {
    setWorking(true);
    try {
      const dataUrl = await capture();
      const { jsPDF } = await import("jspdf");
      const img = new Image();
      img.src = dataUrl;
      await new Promise(res => { img.onload = res; });
      const w = img.naturalWidth / 2;
      const h = img.naturalHeight / 2;
      const pdf = new jsPDF({ orientation: "portrait", unit: "px", format: [w, h] });
      pdf.addImage(dataUrl, "PNG", 0, 0, w, h);
      pdf.save(`${filename}.pdf`);
    } finally { setWorking(false); }
  };

  const share = async () => {
    setWorking(true);
    try {
      const dataUrl = await capture();
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const file = new File([blob], `${filename}.png`, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "Receipt" });
      } else {
        const link = document.createElement("a");
        link.download = `${filename}.png`;
        link.href = dataUrl;
        link.click();
      }
    } finally { setWorking(false); }
  };

  return { downloadImage, downloadPDF, share, working };
}
