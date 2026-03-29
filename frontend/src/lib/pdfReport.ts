import jsPDF from "jspdf";
import html2canvas from "html2canvas";

export async function generateMultiPagePdf(elementIds: string[], fileName: string) {
  const pdf = new jsPDF("p", "mm", "a4");
  const pdfWidth = pdf.internal.pageSize.getWidth();
  
  // Store scroll
  const originalScrollPos = window.scrollY;
  window.scrollTo(0, 0);

  try {
    for (let i = 0; i < elementIds.length; i++) {
      const element = document.getElementById(elementIds[i]);
      if (!element) {
        console.warn(`Element with id ${elementIds[i]} not found, skipping.`);
        continue;
      }

      // Capture each element individually
      const canvas = await html2canvas(element, {
        scale: 1.5,
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
        windowWidth: 1100, // Matched to report container width
      });

      const imgData = canvas.toDataURL("image/jpeg", 0.7); // 70% JPEG compression for major memory savings
      const imgProps = pdf.getImageProperties(imgData);
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

      if (i > 0) {
        pdf.addPage();
      }

      // Ensure the image fits vertically or add more pages? For now, we assume 1 section = 1 page
      pdf.addImage(imgData, "JPEG", 0, 0, pdfWidth, pdfHeight);
      
      // Cleanup canvas memory
      canvas.width = 0;
      canvas.height = 0;
    }

    pdf.save(fileName);
  } finally {
    window.scrollTo(0, originalScrollPos);
  }
}
