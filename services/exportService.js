const ExcelJS = require('exceljs');

const thinBorder = {
  top:    { style: 'thin', color: { argb: 'FFCBD5E1' } },
  left:   { style: 'thin', color: { argb: 'FFCBD5E1' } },
  bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
  right:  { style: 'thin', color: { argb: 'FFCBD5E1' } }
};

// ─────────────────────────────────────────────
// 1. Generate RTL Attendance Excel Report
// ─────────────────────────────────────────────
const generateAttendanceExcel = async (section, attendanceStats) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'الجامعة المستنصرية - UAMS';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('سجل الحضور والغياب', {
    views: [{ rightToLeft: true }] // RTL Arabic
  });

  // Main University Banner
  worksheet.mergeCells('A1:H1');
  const banner = worksheet.getCell('A1');
  banner.value = 'الجامعة المستنصرية - نظام إدارة الشؤون الأكاديمية (UAMS)';
  banner.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  banner.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
  banner.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(1).height = 35;

  // Section Title Sub-banner
  worksheet.mergeCells('A2:H2');
  const subBanner = worksheet.getCell('A2');
  subBanner.value = `تقرير الحضور والغياب: ${section.course ? section.course.name : ''} (${section.course ? section.course.code : ''}) - شعبة ${section.sectionNumber} | الفصل: ${section.semester || ''} ${section.academicYear || ''}`;
  subBanner.font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
  subBanner.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
  subBanner.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(2).height = 28;

  // Table Column Headers
  const headers = [
    'ت',
    'الرقم الجامعي',
    'اسم الطالب',
    'البريد الجامعي',
    'إجمالي المحاضرات',
    'عدد الحضور',
    'عدد الغياب',
    'نسبة الحضور',
    'الحالة والإنذارات'
  ];

  worksheet.getRow(4).values = headers;
  worksheet.getRow(4).font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
  worksheet.getRow(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
  worksheet.getRow(4).alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(4).height = 26;

  // Add Data Rows with conditional status formatting
  attendanceStats.forEach((stat, index) => {
    const rowNumber = index + 5;
    const row = worksheet.addRow([
      index + 1,
      stat.studentId || 'N/A',
      stat.studentName,
      stat.studentEmail,
      stat.totalSessions,
      stat.presentCount,
      stat.absentCount,
      `${stat.attendanceRate}%`,
      stat.warningLevel
    ]);

    row.height = 22;
    row.alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell(3).alignment = { vertical: 'middle', horizontal: 'right' }; // Name right-aligned
    row.getCell(4).alignment = { vertical: 'middle', horizontal: 'left' };  // Email left-aligned

    // Apply borders and zebra striping
    const isEven = index % 2 === 0;
    for (let c = 1; c <= 9; c++) {
      const cell = row.getCell(c);
      cell.border = thinBorder;
      if (isEven) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      }
    }

    // Color highlight for warnings
    const statusCell = row.getCell(9);
    if (stat.warningLevel.includes('حرمان') || stat.warningLevel.includes('DISMISSAL')) {
      statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
      statusCell.font = { bold: true, color: { argb: 'FFDC2626' } };
    } else if (stat.warningLevel.includes('نهائي')) {
      statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
      statusCell.font = { bold: true, color: { argb: 'FFD97706' } };
    } else if (stat.warningLevel.includes('تنبيه')) {
      statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF9C3' } };
      statusCell.font = { bold: true, color: { argb: 'FFCA8A04' } };
    } else {
      statusCell.font = { color: { argb: 'FF16A34A' } };
    }
  });

  worksheet.columns = [
    { width: 6 },
    { width: 16 },
    { width: 28 },
    { width: 34 },
    { width: 16 },
    { width: 14 },
    { width: 14 },
    { width: 14 },
    { width: 22 }
  ];

  return workbook;
};

// ─────────────────────────────────────────────
// 2. Generate RTL Grades Excel Report
// ─────────────────────────────────────────────
const generateGradesExcel = async (section, gradeRows, examHeaders) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'الجامعة المستنصرية - UAMS';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('كشف الدرجات الأكاديمية', {
    views: [{ rightToLeft: true }] // RTL Arabic
  });

  const totalCols = 5 + examHeaders.length; // #, ID, Name, Email, exams..., Total, Grade

  // University Banner
  worksheet.mergeCells(1, 1, 1, totalCols);
  const banner = worksheet.getCell(1, 1);
  banner.value = 'الجامعة المستنصرية - سجل الدرجات والتقييم الأكاديمي';
  banner.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  banner.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
  banner.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(1).height = 35;

  // Sub-banner
  worksheet.mergeCells(2, 1, 2, totalCols);
  const subBanner = worksheet.getCell(2, 1);
  subBanner.value = `مادة: ${section.course ? section.course.name : ''} (${section.course ? section.course.code : ''}) - شعبة ${section.sectionNumber} | أستاذ المادة: ${section.doctor ? section.doctor.name : ''}`;
  subBanner.font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
  subBanner.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF065F46' } };
  subBanner.alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(2).height = 28;

  // Table Headers
  const headers = ['ت', 'الرقم الجامعي', 'اسم الطالب', 'البريد الجامعي', ...examHeaders, 'المجموع النهائي (100%)', 'التقدير'];
  worksheet.getRow(4).values = headers;
  worksheet.getRow(4).font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
  worksheet.getRow(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF059669' } };
  worksheet.getRow(4).alignment = { horizontal: 'center', vertical: 'middle' };
  worksheet.getRow(4).height = 26;

  gradeRows.forEach((row, index) => {
    const tableRow = worksheet.addRow([index + 1, ...row]);
    tableRow.height = 22;
    tableRow.alignment = { vertical: 'middle', horizontal: 'center' };
    tableRow.getCell(3).alignment = { vertical: 'middle', horizontal: 'right' }; // Student Name
    tableRow.getCell(4).alignment = { vertical: 'middle', horizontal: 'left' };  // Email

    const isEven = index % 2 === 0;
    for (let c = 1; c <= totalCols; c++) {
      const cell = tableRow.getCell(c);
      cell.border = thinBorder;
      if (isEven) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      }
    }

    // Highlight failing grade
    const letterGradeCell = tableRow.getCell(totalCols);
    if (letterGradeCell.value === 'F' || letterGradeCell.value === 'راسب') {
      letterGradeCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
      letterGradeCell.font = { bold: true, color: { argb: 'FFDC2626' } };
    }
  });

  worksheet.columns = [
    { width: 6 },
    { width: 16 },
    { width: 28 },
    { width: 34 },
    ...examHeaders.map(() => ({ width: 18 })),
    { width: 22 },
    { width: 14 }
  ];

  return workbook;
};

module.exports = {
  generateAttendanceExcel,
  generateGradesExcel
};
