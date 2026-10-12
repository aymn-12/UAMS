/**
 * GPA and grading calculation engine based on Iraqi Higher Education standards
 * Scale:
 *   90 - 100%: A (4.0) امتياز
 *   80 - 89.9%: B (3.0) جيد جداً
 *   70 - 79.9%: C (2.0) جيد
 *   60 - 69.9%: D (1.0) متوسط
 *   50 - 59.9%: E (0.5) مقبول
 *   < 50%:      F (0.0) راسب
 */

const calculateLetterGrade = (scorePercentage) => {
  const rounded = Math.round(scorePercentage * 10) / 10;

  if (rounded >= 90) return { letter: 'A', gpaPoint: 4.0, description: 'امتياز', isPassed: true };
  if (rounded >= 80) return { letter: 'B', gpaPoint: 3.0, description: 'جيد جداً', isPassed: true };
  if (rounded >= 70) return { letter: 'C', gpaPoint: 2.0, description: 'جيد', isPassed: true };
  if (rounded >= 60) return { letter: 'D', gpaPoint: 1.0, description: 'متوسط', isPassed: true };
  if (rounded >= 50) return { letter: 'E', gpaPoint: 0.5, description: 'مقبول', isPassed: true };
  return { letter: 'F', gpaPoint: 0.0, description: 'راسب', isPassed: false };
};

const calculateCumulativeGPA = (courseGrades) => {
  if (!courseGrades || courseGrades.length === 0) return 0.0;

  let totalQualityPoints = 0;
  let totalCredits = 0;

  courseGrades.forEach(({ totalPercentage, credits }) => {
    const { gpaPoint } = calculateLetterGrade(totalPercentage);
    totalQualityPoints += gpaPoint * credits;
    totalCredits += credits;
  });

  if (totalCredits === 0) return 0.0;
  return Number((totalQualityPoints / totalCredits).toFixed(2));
};

module.exports = {
  calculateLetterGrade,
  calculateCumulativeGPA
};
