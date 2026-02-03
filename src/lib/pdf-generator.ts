import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// Ibbra brand colors
const IBBRA_NAVY = [1, 30, 64] as const; // #011e40
const IBBRA_BLUE = [2, 93, 186] as const; // #025dba
const IBBRA_BEIGE = [234, 225, 220] as const; // #eae1dc
const GREEN_600 = [22, 163, 74] as const;
const RED_600 = [220, 38, 38] as const;

interface PDFGeneratorOptions {
  title: string;
  subtitle?: string;
  period?: { start: Date; end: Date };
  orientation?: "portrait" | "landscape";
}

// Margins and page config
const MARGIN_LEFT = 20;
const MARGIN_RIGHT = 20;
const MARGIN_BOTTOM = 20;

// Logo path - will be loaded as image
const LOGO_PATH = "/ibbra-logo-pdf.png";

const addLogo = async (doc: jsPDF, x: number, y: number): Promise<void> => {
  try {
    // Load and add the actual logo image
    const img = new Image();
    img.crossOrigin = "anonymous";
    
    await new Promise<void>((resolve, reject) => {
      img.onload = () => {
        // Calculate dimensions to maintain aspect ratio (original is wide)
        const logoHeight = 12;
        const logoWidth = logoHeight * (img.width / img.height);
        doc.addImage(img, "PNG", x, y, logoWidth, logoHeight);
        resolve();
      };
      img.onerror = () => {
        // Fallback to text if image fails to load
        doc.setTextColor(...IBBRA_NAVY);
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("IBBRA", x, y + 10);
        resolve();
      };
      img.src = LOGO_PATH;
    });
  } catch {
    // Fallback to text
    doc.setTextColor(...IBBRA_NAVY);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("IBBRA", x, y + 10);
  }
};

export async function createProfessionalPDF(options: PDFGeneratorOptions): Promise<jsPDF> {
  const { title, subtitle, period, orientation = "portrait" } = options;
  const doc = new jsPDF({ orientation });
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Clean header with subtle beige accent
  doc.setFillColor(...IBBRA_BEIGE);
  doc.rect(0, 0, pageWidth, 35, "F");
  
  // Navy accent line at bottom of header
  doc.setFillColor(...IBBRA_NAVY);
  doc.rect(0, 35, pageWidth, 1.5, "F");
  
  // Add logo
  await addLogo(doc, MARGIN_LEFT, 11);
  
  // Title - right aligned, elegant
  doc.setTextColor(...IBBRA_NAVY);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(title, pageWidth - MARGIN_RIGHT, 18, { align: "right" });
  
  // Subtitle and period
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80, 80, 80);
  
  if (subtitle) {
    doc.text(subtitle, pageWidth - MARGIN_RIGHT, 25, { align: "right" });
  }
  
  if (period) {
    const periodText = `${format(period.start, "dd MMM yyyy", { locale: ptBR })} — ${format(period.end, "dd MMM yyyy", { locale: ptBR })}`;
    doc.text(periodText, pageWidth - MARGIN_RIGHT, 31, { align: "right" });
  }
  
  // Generated date - subtle, bottom of header area
  doc.setFontSize(7);
  doc.setTextColor(120, 120, 120);
  doc.text(`Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, MARGIN_LEFT, 44);
  
  return doc;
}

export function formatCurrencyForPDF(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function addSummarySection(
  doc: jsPDF, 
  items: { label: string; value: string; highlight?: "positive" | "negative" }[],
  startY: number
): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const availableWidth = pageWidth - MARGIN_LEFT - MARGIN_RIGHT;
  const gap = 8;
  const cardWidth = (availableWidth - gap * (items.length - 1)) / items.length;
  const cardHeight = 28;
  
  items.forEach((item, index) => {
    const xPos = MARGIN_LEFT + index * (cardWidth + gap);
    
    // Card background - subtle and elegant
    doc.setLineWidth(0.3);
    if (item.highlight === "positive") {
      doc.setFillColor(245, 255, 250);
      doc.setDrawColor(...GREEN_600);
    } else if (item.highlight === "negative") {
      doc.setFillColor(255, 250, 250);
      doc.setDrawColor(...RED_600);
    } else {
      doc.setFillColor(250, 250, 252);
      doc.setDrawColor(200, 200, 200);
    }
    doc.roundedRect(xPos, startY, cardWidth, cardHeight, 3, 3, "FD");
    
    // Label - small, muted
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.setFont("helvetica", "normal");
    doc.text(item.label, xPos + 6, startY + 10);
    
    // Value - prominent
    doc.setFontSize(12);
    if (item.highlight === "positive") {
      doc.setTextColor(...GREEN_600);
    } else if (item.highlight === "negative") {
      doc.setTextColor(...RED_600);
    } else {
      doc.setTextColor(...IBBRA_NAVY);
    }
    doc.setFont("helvetica", "bold");
    doc.text(item.value, xPos + 6, startY + 21);
  });
  
  return startY + cardHeight + 12;
}

export function addTableWithStyle(
  doc: jsPDF,
  headers: string[],
  body: (string | number)[][],
  startY: number,
  options?: {
    columnStyles?: Record<number, { halign?: "left" | "center" | "right"; cellWidth?: number }>;
    headStyles?: Partial<{
      fillColor: [number, number, number];
      textColor: [number, number, number];
    }>;
  }
): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  
  autoTable(doc, {
    startY,
    head: [headers],
    body: body.map(row => row.map(cell => String(cell))),
    theme: "plain",
    margin: { left: MARGIN_LEFT, right: MARGIN_RIGHT },
    headStyles: {
      fillColor: options?.headStyles?.fillColor || [...IBBRA_NAVY],
      textColor: options?.headStyles?.textColor || [255, 255, 255],
      fontSize: 9,
      fontStyle: "bold",
      halign: "center",
      cellPadding: 4,
    },
    bodyStyles: {
      fontSize: 8,
      cellPadding: 3,
      textColor: [50, 50, 50],
    },
    alternateRowStyles: {
      fillColor: [250, 250, 252],
    },
    columnStyles: options?.columnStyles || {},
    styles: {
      lineColor: [230, 230, 230],
      lineWidth: 0.1,
      overflow: "linebreak",
    },
    didDrawPage: (data) => {
      if (data.pageNumber > 1) {
        // Add minimal header to continuation pages
        doc.setFillColor(...IBBRA_BEIGE);
        doc.rect(0, 0, pageWidth, 15, "F");
        doc.setFillColor(...IBBRA_NAVY);
        doc.rect(0, 15, pageWidth, 0.5, "F");
        doc.setTextColor(...IBBRA_NAVY);
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text("IBBRA", MARGIN_LEFT, 10);
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100, 100, 100);
        doc.text("(continuação)", MARGIN_LEFT + 25, 10);
      }
    },
  });
  
  return (doc as any).lastAutoTable?.finalY || startY + 50;
}

export function addDRETable(
  doc: jsPDF,
  lines: { label: string; value: number; percentage?: number; isTotal?: boolean; isSubtotal?: boolean; indent?: number }[],
  startY: number
): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - MARGIN_LEFT - MARGIN_RIGHT;
  const rowHeight = 8;
  
  // Header
  doc.setFillColor(...IBBRA_NAVY);
  doc.roundedRect(MARGIN_LEFT, startY, contentWidth, 10, 2, 2, "F");
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("Descrição", MARGIN_LEFT + 6, startY + 6.5);
  doc.text("Valor", pageWidth - 50, startY + 6.5, { align: "right" });
  doc.text("% RL", pageWidth - MARGIN_RIGHT - 4, startY + 6.5, { align: "right" });
  
  let yPos = startY + 14;
  
  lines.forEach((line, index) => {
    // Check for page break
    if (yPos > pageHeight - MARGIN_BOTTOM - 10) {
      doc.addPage();
      // Add minimal continuation header
      doc.setFillColor(...IBBRA_BEIGE);
      doc.rect(0, 0, pageWidth, 15, "F");
      doc.setFillColor(...IBBRA_NAVY);
      doc.rect(0, 15, pageWidth, 0.5, "F");
      doc.setTextColor(...IBBRA_NAVY);
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("IBBRA", MARGIN_LEFT, 10);
      yPos = 28;
    }
    
    if (line.label === "") {
      yPos += 3;
      return;
    }
    
    // Row background
    if (line.isTotal) {
      doc.setFillColor(...IBBRA_NAVY);
      doc.roundedRect(MARGIN_LEFT, yPos - 5, contentWidth, rowHeight + 1, 1, 1, "F");
    } else if (line.isSubtotal) {
      doc.setFillColor(...IBBRA_BEIGE);
      doc.rect(MARGIN_LEFT, yPos - 5, contentWidth, rowHeight, "F");
    } else if (index % 2 === 0) {
      doc.setFillColor(252, 252, 254);
      doc.rect(MARGIN_LEFT, yPos - 5, contentWidth, rowHeight, "F");
    }
    
    // Label
    const indent = line.indent ? line.indent * 8 : 0;
    doc.setFontSize(line.isTotal ? 9 : line.isSubtotal ? 8.5 : 8);
    doc.setFont("helvetica", line.isTotal || line.isSubtotal ? "bold" : "normal");
    
    if (line.isTotal) {
      doc.setTextColor(255, 255, 255);
    } else {
      doc.setTextColor(...IBBRA_NAVY);
    }
    doc.text(line.label, MARGIN_LEFT + 6 + indent, yPos);
    
    // Value
    if (line.isTotal) {
      doc.setTextColor(255, 255, 255);
    } else if (line.value >= 0) {
      doc.setTextColor(GREEN_600[0], GREEN_600[1], GREEN_600[2]);
    } else {
      doc.setTextColor(RED_600[0], RED_600[1], RED_600[2]);
    }
    doc.text(formatCurrencyForPDF(Math.abs(line.value)), pageWidth - 50, yPos, { align: "right" });
    
    // Percentage
    if (line.percentage !== undefined) {
      if (line.isTotal) {
        doc.setTextColor(255, 255, 255);
      } else {
        doc.setTextColor(100, 100, 100);
      }
      doc.text(`${Math.abs(line.percentage).toFixed(1)}%`, pageWidth - MARGIN_RIGHT - 4, yPos, { align: "right" });
    }
    
    yPos += rowHeight;
  });
  
  return yPos + 8;
}

export function addCategoryHierarchyTable(
  doc: jsPDF,
  data: {
    incomeCategories: { name: string; total: number; children: { name: string; total: number }[] }[];
    expenseCategories: { name: string; total: number; children: { name: string; total: number }[] }[];
    totalIncome: number;
    totalExpense: number;
    balance: number;
  },
  startY: number
): number {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - MARGIN_LEFT - MARGIN_RIGHT;
  
  let yPos = startY;
  
  const checkPageBreak = (requiredSpace: number): void => {
    if (yPos + requiredSpace > pageHeight - MARGIN_BOTTOM) {
      doc.addPage();
      doc.setFillColor(...IBBRA_BEIGE);
      doc.rect(0, 0, pageWidth, 15, "F");
      doc.setFillColor(...IBBRA_NAVY);
      doc.rect(0, 15, pageWidth, 0.5, "F");
      doc.setTextColor(...IBBRA_NAVY);
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("IBBRA", MARGIN_LEFT, 10);
      yPos = 28;
    }
  };
  
  // RECEITAS Header
  checkPageBreak(12);
  doc.setFillColor(245, 255, 250);
  doc.setDrawColor(...GREEN_600);
  doc.setLineWidth(0.5);
  doc.roundedRect(MARGIN_LEFT, yPos, contentWidth, 10, 2, 2, "FD");
  
  doc.setTextColor(...GREEN_600);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("RECEITAS", MARGIN_LEFT + 8, yPos + 7);
  doc.text(formatCurrencyForPDF(data.totalIncome), pageWidth - MARGIN_RIGHT - 8, yPos + 7, { align: "right" });
  
  yPos += 14;
  
  // Income categories
  data.incomeCategories.forEach((cat) => {
    checkPageBreak(8 + cat.children.length * 6);
    
    // Parent category
    doc.setFillColor(250, 255, 252);
    doc.rect(MARGIN_LEFT + 4, yPos - 4, contentWidth - 8, 7, "F");
    
    doc.setTextColor(...IBBRA_NAVY);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text(cat.name, MARGIN_LEFT + 10, yPos);
    doc.setTextColor(...GREEN_600);
    doc.text(formatCurrencyForPDF(cat.total), pageWidth - MARGIN_RIGHT - 12, yPos, { align: "right" });
    
    yPos += 8;
    
    // Children
    cat.children.forEach((child) => {
      checkPageBreak(6);
      
      doc.setTextColor(80, 80, 80);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text(`• ${child.name}`, MARGIN_LEFT + 18, yPos);
      doc.setTextColor(...GREEN_600);
      doc.text(formatCurrencyForPDF(child.total), pageWidth - MARGIN_RIGHT - 12, yPos, { align: "right" });
      
      yPos += 5;
    });
    
    yPos += 2;
  });
  
  yPos += 8;
  
  // DESPESAS Header
  checkPageBreak(12);
  doc.setFillColor(255, 250, 250);
  doc.setDrawColor(...RED_600);
  doc.setLineWidth(0.5);
  doc.roundedRect(MARGIN_LEFT, yPos, contentWidth, 10, 2, 2, "FD");
  
  doc.setTextColor(...RED_600);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("DESPESAS", MARGIN_LEFT + 8, yPos + 7);
  doc.text(formatCurrencyForPDF(data.totalExpense), pageWidth - MARGIN_RIGHT - 8, yPos + 7, { align: "right" });
  
  yPos += 14;
  
  // Expense categories
  data.expenseCategories.forEach((cat) => {
    checkPageBreak(8 + cat.children.length * 6);
    
    // Parent category
    doc.setFillColor(255, 252, 252);
    doc.rect(MARGIN_LEFT + 4, yPos - 4, contentWidth - 8, 7, "F");
    
    doc.setTextColor(...IBBRA_NAVY);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text(cat.name, MARGIN_LEFT + 10, yPos);
    doc.setTextColor(...RED_600);
    doc.text(formatCurrencyForPDF(cat.total), pageWidth - MARGIN_RIGHT - 12, yPos, { align: "right" });
    
    yPos += 8;
    
    // Children
    cat.children.forEach((child) => {
      checkPageBreak(6);
      
      doc.setTextColor(80, 80, 80);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text(`• ${child.name}`, MARGIN_LEFT + 18, yPos);
      doc.setTextColor(...RED_600);
      doc.text(formatCurrencyForPDF(child.total), pageWidth - MARGIN_RIGHT - 12, yPos, { align: "right" });
      
      yPos += 5;
    });
    
    yPos += 2;
  });
  
  yPos += 12;
  
  // RESULTADO
  checkPageBreak(16);
  const isPositive = data.balance >= 0;
  if (isPositive) {
    doc.setFillColor(245, 255, 250);
    doc.setDrawColor(...GREEN_600);
  } else {
    doc.setFillColor(255, 250, 250);
    doc.setDrawColor(...RED_600);
  }
  doc.setLineWidth(1);
  doc.roundedRect(MARGIN_LEFT, yPos, contentWidth, 12, 3, 3, "FD");
  
  if (isPositive) {
    doc.setTextColor(GREEN_600[0], GREEN_600[1], GREEN_600[2]);
  } else {
    doc.setTextColor(RED_600[0], RED_600[1], RED_600[2]);
  }
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("RESULTADO DO PERÍODO", MARGIN_LEFT + 8, yPos + 8);
  doc.text(formatCurrencyForPDF(data.balance), pageWidth - MARGIN_RIGHT - 8, yPos + 8, { align: "right" });
  
  return yPos + 20;
}

export function addFooter(doc: jsPDF): void {
  const pageCount = doc.getNumberOfPages();
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageWidth = doc.internal.pageSize.getWidth();
  
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    
    // Subtle footer line
    doc.setDrawColor(...IBBRA_BEIGE);
    doc.setLineWidth(0.5);
    doc.line(MARGIN_LEFT, pageHeight - 12, pageWidth - MARGIN_RIGHT, pageHeight - 12);
    
    // Footer text
    doc.setFontSize(7);
    doc.setTextColor(120, 120, 120);
    doc.setFont("helvetica", "normal");
    doc.text("IBBRA Gestão Financeira", MARGIN_LEFT, pageHeight - 6);
    
    doc.setTextColor(...IBBRA_NAVY);
    doc.setFont("helvetica", "bold");
    doc.text(`${i}/${pageCount}`, pageWidth / 2, pageHeight - 6, { align: "center" });
    
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120, 120, 120);
    doc.text("www.ibbra.com.br", pageWidth - MARGIN_RIGHT, pageHeight - 6, { align: "right" });
  }
}
