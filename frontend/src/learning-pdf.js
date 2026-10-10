import { jsPDF } from 'jspdf';

async function renderTextImage(text, { color = '#0b2457', fontSize = 132, weight = 700 } = {}) {
  if (document.fonts?.ready) await document.fonts.ready;
  const canvas = document.createElement('canvas');
  canvas.width = 2400;
  canvas.height = 360;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('This browser could not prepare the certificate text.');

  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillStyle = color;
  context.font = `${weight} ${fontSize}px Inter, "Noto Sans", system-ui, sans-serif`;
  const availableWidth = canvas.width - 160;
  const measuredWidth = context.measureText(text).width;
  if (measuredWidth > availableWidth) {
    fontSize = Math.floor(fontSize * availableWidth / measuredWidth);
    context.font = `${weight} ${fontSize}px Inter, "Noto Sans", system-ui, sans-serif`;
  }
  context.fillText(text, canvas.width / 2, canvas.height / 2, availableWidth);
  return canvas.toDataURL('image/png');
}

async function loadLogoImage() {
  const response = await fetch(new URL('logo.svg', window.location.href));
  if (!response.ok) throw new Error(`The Vypax logo could not be loaded (${response.status}).`);
  const image = new Image();
  image.src = URL.createObjectURL(await response.blob());
  try {
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = 384;
    canvas.height = 384;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('This browser could not prepare the Vypax logo.');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/png');
  } finally {
    URL.revokeObjectURL(image.src);
  }
}

function addCornerAccents(pdf) {
  pdf.setFillColor(37, 93, 224);
  pdf.triangle(254, 0, 297, 0, 297, 43, 'F');
  pdf.setFillColor(7, 174, 226);
  pdf.triangle(261, 0, 269, 0, 297, 28, 'F');
  pdf.setFillColor(121, 37, 222);
  pdf.triangle(276, 0, 297, 0, 297, 21, 'F');

  pdf.setFillColor(37, 93, 224);
  pdf.triangle(0, 166, 42, 210, 0, 210, 'F');
  pdf.setFillColor(7, 174, 226);
  pdf.triangle(0, 176, 32, 210, 22, 210, 'F');
  pdf.setFillColor(121, 37, 222);
  pdf.triangle(0, 199, 11, 210, 0, 210, 'F');
}

export async function createCertificatePdf({ name, course, issueDate, id }) {
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
  const center = 148.5;
  const logo = await loadLogoImage();

  pdf.setProperties({
    title: `Vypax Technologies Skill Completion Certificate — ${course}`,
    subject: `Skill completion certificate for ${name}`,
    author: 'Vypax Technologies'
  });
  pdf.setFillColor(255, 255, 255);
  pdf.rect(0, 0, 297, 210, 'F');
  addCornerAccents(pdf);

  pdf.setDrawColor(37, 93, 224);
  pdf.setLineWidth(0.45);
  pdf.rect(4.5, 4.5, 288, 201);
  pdf.setDrawColor(7, 174, 226);
  pdf.setLineWidth(0.18);
  pdf.rect(5.8, 5.8, 285.4, 198.4);

  pdf.addImage(logo, 'PNG', 12, 9, 19, 19);
  pdf.setTextColor(11, 36, 87);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(16);
  pdf.text('VYPAX', 34, 17);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.text('T E C H N O L O G I E S', 34, 22);
  pdf.setTextColor(0, 112, 194);
  pdf.setFontSize(7);
  pdf.text('Build beyond limit', 34, 27);

  pdf.setTextColor(16, 54, 130);
  pdf.setFontSize(7);
  pdf.text('CERTIFICATE NO.', 279, 15, { align: 'right', charSpace: 1 });
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.text(id.replace(/^VXP-(\d{4})-(.+)$/, 'VXP/$1/$2'), 279, 21, { align: 'right' });

  pdf.setTextColor(11, 36, 87);
  pdf.setFontSize(29);
  pdf.text('SKILL COMPLETION CERTIFICATE', center, 43, { align: 'center' });
  pdf.setDrawColor(0, 133, 217);
  pdf.setLineWidth(0.3);
  pdf.line(67, 51, 103, 51);
  pdf.line(194, 51, 230, 51);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(16, 91, 177);
  pdf.setFontSize(12);
  pdf.text('T H I S   I S   T O   C E R T I F Y   T H A T', center, 55, { align: 'center' });
  pdf.addImage(await renderTextImage(name, { fontSize: 170 }), 'PNG', 34, 58, 229, 33);

  pdf.setTextColor(20, 60, 120);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(14);
  pdf.text('has successfully completed the skill course in', center, 100, { align: 'center' });
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(22);
  const courseLines = pdf.splitTextToSize(course, 220);
  pdf.text(courseLines, center, 114, { align: 'center', lineHeightFactor: 1.1 });
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(13);
  pdf.text('at Vypax Technologies.', center, 123 + courseLines.length * 4, { align: 'center' });
  pdf.setTextColor(38, 103, 185);
  pdf.setFontSize(11);
  pdf.text('We appreciate your dedication and wish you continued growth and success.', center, 137, { align: 'center' });

  pdf.setDrawColor(28, 117, 213);
  pdf.setLineWidth(0.2);
  [52, 75, 99].forEach(x => pdf.line(x, 151, x, 168));
  const values = [
    ['</>', 'Web', 'Development'],
    ['◇', 'Digital', 'Solutions'],
    ['↗', 'Business', 'Growth'],
    ['◎', 'Technology', '& Innovation']
  ];
  const valueCenters = [40, 63.5, 87, 111];
  values.forEach(([symbol, first, second], index) => {
    const x = valueCenters[index];
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(15);
    pdf.setTextColor(16, 91, 177);
    pdf.text(symbol, x, 155, { align: 'center' });
    pdf.setFontSize(7.5);
    pdf.text([first, second], x, 160, { align: 'center', lineHeightFactor: 1.15 });
  });

  pdf.setDrawColor(16, 91, 177);
  pdf.setLineWidth(0.3);
  pdf.line(161, 160, 209, 160);
  pdf.setTextColor(11, 36, 87);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.text('VYPAX TECHNOLOGIES', 185, 166, { align: 'center' });
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7.5);
  pdf.text('Authorized Representative', 185, 171, { align: 'center' });
  pdf.setFontSize(7);
  pdf.setTextColor(56, 96, 147);
  pdf.text(`Issued: ${issueDate}`, 185, 176, { align: 'center' });

  pdf.setDrawColor(23, 73, 161);
  pdf.setLineWidth(0.5);
  pdf.circle(251, 164, 17);
  pdf.setLineWidth(0.25);
  pdf.circle(251, 164, 15);
  pdf.addImage(logo, 'PNG', 245.5, 157.5, 11, 11);
  pdf.setTextColor(16, 54, 130);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(4.8);
  pdf.text('VYPAX TECHNOLOGIES', 251, 151.5, { align: 'center' });
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(4.5);
  pdf.text('BUILD BEYOND LIMIT', 251, 177, { align: 'center' });

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(6.5);
  pdf.setTextColor(76, 105, 137);
  pdf.text('Browser-generated certificate; course progress is not independently verified by a server.', center, 192, { align: 'center' });

  return pdf.output('blob');
}
