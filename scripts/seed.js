require('dotenv').config();
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

// Models
const User = require('../models/User');
const StudentProfile = require('../models/StudentProfile');
const DoctorProfile = require('../models/DoctorProfile');
const Department = require('../models/Department');
const Course = require('../models/Course');
const Section = require('../models/Section');
const ScheduleSlot = require('../models/ScheduleSlot');
const DigitalId = require('../models/DigitalId');
const AttendanceSession = require('../models/AttendanceSession');
const AttendanceRecord = require('../models/AttendanceRecord');
const Assignment = require('../models/Assignment');
const Submission = require('../models/Submission');
const Exam = require('../models/Exam');
const Grade = require('../models/Grade');
const CourseMaterial = require('../models/CourseMaterial');
const Question = require('../models/Question');
const Announcement = require('../models/Announcement');
const Notification = require('../models/Notification');
const AuditLog = require('../models/AuditLog');

const { ROLES, ACCOUNT_STATUS, ATTENDANCE_STATUS, ASSIGNMENT_STATUS, EXAM_TYPES } = require('../config/constants');

const seedData = async () => {
  try {
    console.log('───────────────────────────────────────────────────────');
    console.log('🌱 Starting University of Mustansiriyah UAMS Seeding...');
    console.log('───────────────────────────────────────────────────────');

    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/uams_db');
    console.log('[1/10] Connected to MongoDB.');

    // Clear existing collections for a fresh clean state
    console.log('[2/10] Resetting existing collections...');
    await Promise.all([
      User.deleteMany({}),
      StudentProfile.deleteMany({}),
      DoctorProfile.deleteMany({}),
      Department.deleteMany({}),
      Course.deleteMany({}),
      Section.deleteMany({}),
      ScheduleSlot.deleteMany({}),
      DigitalId.deleteMany({}),
      AttendanceSession.deleteMany({}),
      AttendanceRecord.deleteMany({}),
      Assignment.deleteMany({}),
      Submission.deleteMany({}),
      Exam.deleteMany({}),
      Grade.deleteMany({}),
      CourseMaterial.deleteMany({}),
      Question.deleteMany({}),
      Announcement.deleteMany({}),
      Notification.deleteMany({}),
      AuditLog.deleteMany({})
    ]);

    // ─────────────────────────────────────────────
    // 1. Department
    // ─────────────────────────────────────────────
    console.log('[3/10] Creating Academic Departments...');
    const deptCpe = await Department.create({
      name: 'قسم هندسة الحاسوب',
      code: 'CPE',
      college: 'كلية الهندسة - الجامعة المستنصرية',
      description: 'قسم هندسة الحاسوب والبرمجيات ونظم المعلومات والذكاء الاصطناعي'
    });

    // ─────────────────────────────────────────────
    // 2. Users (Admin, Doctors, Students)
    // ─────────────────────────────────────────────
    console.log('[4/10] Seeding Users & Security Profiles...');

    // Admin
    const admin = await User.create({
      name: 'المدير العام للنظام (Admin)',
      email: 'admin@uomustansiriyah.edu.iq',
      password: 'Password123',
      role: ROLES.ADMIN,
      department: deptCpe._id,
      status: ACCOUNT_STATUS.ACTIVE
    });

    // Doctor 1 (Prof. Ali)
    const drAli = await User.create({
      name: 'أ.د. علي حسين حميد',
      email: 'dr.ali@uomustansiriyah.edu.iq',
      password: 'Password123',
      role: ROLES.DOCTOR,
      department: deptCpe._id,
      status: ACCOUNT_STATUS.ACTIVE
    });

    await DoctorProfile.create({
      user: drAli._id,
      employeeId: 'DOC_1001',
      department: deptCpe._id,
      academicTitle: 'PROFESSOR',
      officeLocation: 'مبنى الهندسة - غرفة 204'
    });

    deptCpe.headOfDepartment = drAli._id;
    await deptCpe.save();

    // Doctor 2 (Dr. Sara)
    const drSara = await User.create({
      name: 'م.د. سارة جاسم محمد',
      email: 'dr.sara@uomustansiriyah.edu.iq',
      password: 'Password123',
      role: ROLES.DOCTOR,
      department: deptCpe._id,
      status: ACCOUNT_STATUS.ACTIVE
    });

    await DoctorProfile.create({
      user: drSara._id,
      employeeId: 'DOC_1002',
      department: deptCpe._id,
      academicTitle: 'LECTURER',
      officeLocation: 'مبنى الهندسة - مختبر النظم 3'
    });

    // Doctor 3 (Dr. Hassan)
    const drHassan = await User.create({
      name: 'أ.م.د. حسن محمود الخفاجي',
      email: 'dr.hassan@uomustansiriyah.edu.iq',
      password: 'Password123',
      role: ROLES.DOCTOR,
      department: deptCpe._id,
      status: ACCOUNT_STATUS.ACTIVE
    });

    await DoctorProfile.create({
      user: drHassan._id,
      employeeId: 'DOC_1003',
      department: deptCpe._id,
      academicTitle: 'ASSISTANT_PROFESSOR',
      officeLocation: 'مبنى الهندسة - غرفة 108'
    });

    // Student 1 (Aymen)
    const stdAymen = await User.create({
      name: 'أيمن أحمد كريم',
      email: 'aymen@uomustansiriyah.edu.iq',
      password: 'Password123',
      role: ROLES.STUDENT,
      department: deptCpe._id,
      status: ACCOUNT_STATUS.ACTIVE
    });

    const profAymen = await StudentProfile.create({
      user: stdAymen._id,
      studentId: 'STD_2022101',
      department: deptCpe._id,
      stage: 3,
      studyType: 'MORNING',
      admissionYear: 2022,
      academicStatus: 'REGULAR',
      gpa: 88.5,
      totalCredits: 15
    });

    // Student 2 (Zainab)
    const stdZainab = await User.create({
      name: 'زينب حيدر فاضل',
      email: 'zainab@uomustansiriyah.edu.iq',
      password: 'Password123',
      role: ROLES.STUDENT,
      department: deptCpe._id,
      status: ACCOUNT_STATUS.ACTIVE
    });

    const profZainab = await StudentProfile.create({
      user: stdZainab._id,
      studentId: 'STD_2022102',
      department: deptCpe._id,
      stage: 3,
      studyType: 'MORNING',
      admissionYear: 2022,
      academicStatus: 'REGULAR',
      gpa: 84.0,
      totalCredits: 15
    });

    // Student 3 (Mustafa)
    const stdMustafa = await User.create({
      name: 'مصطفى خالد سلمان',
      email: 'mustafa@uomustansiriyah.edu.iq',
      password: 'Password123',
      role: ROLES.STUDENT,
      department: deptCpe._id,
      status: ACCOUNT_STATUS.ACTIVE
    });

    const profMustafa = await StudentProfile.create({
      user: stdMustafa._id,
      studentId: 'STD_2022103',
      department: deptCpe._id,
      stage: 3,
      studyType: 'MORNING',
      admissionYear: 2022,
      academicStatus: 'REGULAR',
      gpa: 76.5,
      totalCredits: 15
    });

    // ─────────────────────────────────────────────
    // 3. Digital ID Cards
    // ─────────────────────────────────────────────
    console.log('[5/10] Issuing Encrypted Digital IDs for Students...');
    const expiry = new Date();
    expiry.setFullYear(expiry.getFullYear() + 3);

    await DigitalId.create([
      {
        student: stdAymen._id,
        cardUid: 'CARD_AYMEN2026',
        barcodeNumber: `BC_${profAymen.studentId}`,
        expiryDate: expiry,
        qrSecurityToken: uuidv4()
      },
      {
        student: stdZainab._id,
        cardUid: 'CARD_ZAINAB2026',
        barcodeNumber: `BC_${profZainab.studentId}`,
        expiryDate: expiry,
        qrSecurityToken: uuidv4()
      },
      {
        student: stdMustafa._id,
        cardUid: 'CARD_MUSTAFA2026',
        barcodeNumber: `BC_${profMustafa.studentId}`,
        expiryDate: expiry,
        qrSecurityToken: uuidv4()
      }
    ]);

    // ─────────────────────────────────────────────
    // 4. Courses & Sections (5 Core Courses = 15 Credits)
    // ─────────────────────────────────────────────
    console.log('[6/10] Setting Up Courses & Class Sections...');

    const courseDS = await Course.create({
      name: 'هياكل البيانات والخوارزميات',
      code: 'CPE301',
      department: deptCpe._id,
      stage: 3,
      credits: 3,
      description: 'دراسة هياكل البيانات المتقدمة وخوارزميات البحث والفرز والتعقيد الحسابي'
    });

    const courseDB = await Course.create({
      name: 'نظم إدارة قواعد البيانات',
      code: 'CPE302',
      department: deptCpe._id,
      stage: 3,
      credits: 3,
      description: 'تصميم وتنفيذ قواعد البيانات العلائقية ولغة SQL والتطبيع ومعالجة المعاملات'
    });

    const courseNet = await Course.create({
      name: 'شبكات الحاسوب ونقل البيانات',
      code: 'CPE303',
      department: deptCpe._id,
      stage: 3,
      credits: 3,
      description: 'معمارية شبكات TCP/IP والتوجيه وتبديل الحزم وبروتوكولات الشبكات المحلية واللاسلكية'
    });

    const courseSE = await Course.create({
      name: 'هندسة البرمجيات وتصميم النظم',
      code: 'CPE304',
      department: deptCpe._id,
      stage: 3,
      credits: 3,
      description: 'منهجيات دورة حياة تطوير البرمجيات ونماذج Agile وتصميم الأنظمة عبر UML'
    });

    const courseOS = await Course.create({
      name: 'نظم التشغيل والمعالجة المتزامنة',
      code: 'CPE305',
      department: deptCpe._id,
      stage: 3,
      credits: 3,
      description: 'إدارة الذاكرة والعمليات وجدولة المعالج والتزامن وأنظمة الملفات الحديثة'
    });

    // Sections (Classes) - All with Aymen enrolled
    const allStudents = [stdAymen._id, stdZainab._id, stdMustafa._id];

    const secDS = await Section.create({
      course: courseDS._id,
      sectionNumber: 'A1',
      doctor: drAli._id,
      semester: 'FIRST',
      academicYear: '2025-2026',
      capacity: 50,
      students: allStudents,
      maxAbsenceHours: 6
    });

    const secDB = await Section.create({
      course: courseDB._id,
      sectionNumber: 'B1',
      doctor: drSara._id,
      semester: 'FIRST',
      academicYear: '2025-2026',
      capacity: 50,
      students: allStudents,
      maxAbsenceHours: 6
    });

    const secNet = await Section.create({
      course: courseNet._id,
      sectionNumber: 'C1',
      doctor: drHassan._id,
      semester: 'FIRST',
      academicYear: '2025-2026',
      capacity: 50,
      students: allStudents,
      maxAbsenceHours: 6
    });

    const secSE = await Section.create({
      course: courseSE._id,
      sectionNumber: 'D1',
      doctor: drSara._id,
      semester: 'FIRST',
      academicYear: '2025-2026',
      capacity: 50,
      students: allStudents,
      maxAbsenceHours: 6
    });

    const secOS = await Section.create({
      course: courseOS._id,
      sectionNumber: 'E1',
      doctor: drAli._id,
      semester: 'FIRST',
      academicYear: '2025-2026',
      capacity: 50,
      students: allStudents,
      maxAbsenceHours: 6
    });

    // Timetable Slots
    await ScheduleSlot.create([
      {
        section: secDS._id,
        dayOfWeek: 'SUNDAY',
        startTime: '08:30',
        endTime: '10:30',
        room: 'قاعة الخوارزمي 1',
        building: 'مبنى هندسة الحاسوب'
      },
      {
        section: secDB._id,
        dayOfWeek: 'MONDAY',
        startTime: '10:30',
        endTime: '12:30',
        room: 'مختبر البرمجيات 2',
        building: 'مبنى الحاسبات المركزي'
      },
      {
        section: secNet._id,
        dayOfWeek: 'TUESDAY',
        startTime: '09:00',
        endTime: '11:00',
        room: 'مختبر الشبكات المتقدم 1',
        building: 'مبنى الهندسة'
      },
      {
        section: secSE._id,
        dayOfWeek: 'WEDNESDAY',
        startTime: '11:00',
        endTime: '13:00',
        room: 'قاعة ابن الهيثم 3',
        building: 'مبنى هندسة الحاسوب'
      },
      {
        section: secOS._id,
        dayOfWeek: 'THURSDAY',
        startTime: '08:30',
        endTime: '10:30',
        room: 'مختبر النظم والمعالجة 4',
        building: 'مبنى الهندسة'
      }
    ]);

    // ─────────────────────────────────────────────
    // 5. Course Materials
    // ─────────────────────────────────────────────
    console.log('[7/10] Seeding Lecture Materials...');

    await CourseMaterial.create([
      {
        section: secDS._id,
        uploadedBy: drAli._id,
        title: 'المحاضرة 1: مقدمة في هياكل البيانات والتعقيد الزمني Big-O',
        description: 'شرح مفصل لمفهوم Big-O Notation والـ Arrays والـ Linked Lists',
        fileUrl: '/uploads/lecture_1_data_structures.pdf',
        fileName: 'lecture_1_data_structures.pdf',
        fileSize: 2450120,
        fileType: 'application/pdf',
        isLecture: true,
        lectureDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
      },
      {
        section: secDB._id,
        uploadedBy: drSara._id,
        title: 'المحاضرة 1: مدخل إلى نظم قواعد البيانات ونماذج العلاقات ERD',
        description: 'تصميم قواعد البيانات العلائقية ومفاهيم المفاتيح الأساسية والأجنبية',
        fileUrl: '/uploads/lecture_1_databases.pdf',
        fileName: 'lecture_1_databases.pdf',
        fileSize: 3120400,
        fileType: 'application/pdf',
        isLecture: true,
        lectureDate: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000)
      },
      {
        section: secNet._id,
        uploadedBy: drHassan._id,
        title: 'المحاضرة 1: معمارية شبكات OSI و TCP/IP Protocols',
        description: 'طبقات الشبكة السبعة، بروتوكولات التوجيه ونقل البيانات',
        fileUrl: '/uploads/lecture_1_networks.pdf',
        fileName: 'lecture_1_networks.pdf',
        fileSize: 4510000,
        fileType: 'application/pdf',
        isLecture: true,
        lectureDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000)
      },
      {
        section: secSE._id,
        uploadedBy: drSara._id,
        title: 'المحاضرة 1: هندسة المتطلبات ونمذجة البرمجيات بنماذج UML',
        description: 'جمع وتوثيق متطلبات الأنظمة البرمجية ومخططات Use Case',
        fileUrl: '/uploads/lecture_1_software_eng.pdf',
        fileName: 'lecture_1_software_eng.pdf',
        fileSize: 2890500,
        fileType: 'application/pdf',
        isLecture: true,
        lectureDate: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000)
      },
      {
        section: secOS._id,
        uploadedBy: drAli._id,
        title: 'المحاضرة 1: بنية نظم التشغيل وإدارة العمليات Process Management',
        description: 'حالات العمليات في الذاكرة وكتلة التحكم بالعملية PCB والـ Context Switching',
        fileUrl: '/uploads/lecture_1_operating_systems.pdf',
        fileName: 'lecture_1_operating_systems.pdf',
        fileSize: 3670000,
        fileType: 'application/pdf',
        isLecture: true,
        lectureDate: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000)
      }
    ]);

    // ─────────────────────────────────────────────
    // 6. Attendance Sessions & Records (Realistic ~92% rate)
    // ─────────────────────────────────────────────
    console.log('[8/10] Recording Real Attendance History & Sessions...');

    const nowTime = Date.now();
    const sectionsList = [secDS, secDB, secNet, secSE, secOS];
    let totalSessionsCreated = 0;

    for (let i = 0; i < sectionsList.length; i++) {
      const currentSec = sectionsList[i];
      // Create 3 sessions per section = 15 total sessions
      for (let s = 1; s <= 3; s++) {
        totalSessionsCreated++;
        const sessionTime = new Date(nowTime - (15 - totalSessionsCreated) * 2 * 24 * 60 * 60 * 1000);
        const attSession = await AttendanceSession.create({
          section: currentSec._id,
          doctor: currentSec.doctor,
          sessionTitle: `المحاضرة ${s}: الجلسة الأكاديمية الرسمية`,
          dynamicToken: `OTP_${Math.floor(100000 + Math.random() * 900000)}`,
          startTime: sessionTime,
          expiresAt: new Date(sessionTime.getTime() + 120 * 60 * 1000),
          status: 'CLOSED',
          checkInCount: 3
        });

        // Aymen attended 14 out of 15 sessions (absent once in session 5) -> 93.3% rate
        const isAymenPresent = totalSessionsCreated !== 5;

        await AttendanceRecord.create({
          session: attSession._id,
          student: stdAymen._id,
          section: currentSec._id,
          status: isAymenPresent ? ATTENDANCE_STATUS.PRESENT : ATTENDANCE_STATUS.ABSENT,
          markedMethod: isAymenPresent ? 'QR' : 'MANUAL_DOCTOR',
          geoVerified: isAymenPresent,
          markedAt: sessionTime
        });

        await AttendanceRecord.create({
          session: attSession._id,
          student: stdZainab._id,
          section: currentSec._id,
          status: ATTENDANCE_STATUS.PRESENT,
          markedMethod: 'QR',
          geoVerified: true,
          markedAt: sessionTime
        });

        await AttendanceRecord.create({
          session: attSession._id,
          student: stdMustafa._id,
          section: currentSec._id,
          status: ATTENDANCE_STATUS.PRESENT,
          markedMethod: 'QR',
          geoVerified: true,
          markedAt: sessionTime
        });
      }
    }

    // ─────────────────────────────────────────────
    // 7. Assignments & Submissions
    // ─────────────────────────────────────────────
    console.log('[9/10] Seeding Multi-Course Assignments & Student Submissions...');

    // Assignment 1 (Data Structures) - Submitted & Graded
    const assignment1 = await Assignment.create({
      section: secDS._id,
      doctor: drAli._id,
      title: 'الواجب الأول: تنفيذ خوارزمية Binary Search Tree (BST)',
      description: 'كتابة برنامج بلغة C++ أو Java لإنشاء شجرة بحث ثنائية مع دوال الإضافة والبحث والفرز Inorder',
      deadline: new Date(nowTime + 4 * 24 * 60 * 60 * 1000),
      maxScore: 10,
      allowLate: true
    });

    await Submission.create({
      assignment: assignment1._id,
      student: stdAymen._id,
      submittedFiles: [
        {
          fileName: 'bst_tree_solution.cpp',
          fileUrl: '/uploads/bst_tree_solution.cpp',
          fileSize: 4520
        }
      ],
      studentNotes: 'تم إنجاز الخوارزمية مع حالات الاختبار الشاملة والتعليقات التوضيحية.',
      status: ASSIGNMENT_STATUS.GRADED,
      score: 9.5,
      doctorFeedback: 'حل نموذجي وموثق بشكل احترافي. أحسنت.',
      gradedAt: new Date(),
      gradedBy: drAli._id
    });

    // Assignment 2 (Databases) - Open, Pending Submission
    const assignment2 = await Assignment.create({
      section: secDB._id,
      doctor: drSara._id,
      title: 'الواجب الثاني: تصميم مخطط العلاقات ERD ونظام استعلامات SQL',
      description: 'تصميم مخطط قاعدة بيانات لنظام إدارة مستشفى مع كتابة استعلامات التجميع والربط Joins',
      deadline: new Date(nowTime + 6 * 24 * 60 * 60 * 1000),
      maxScore: 10,
      allowLate: false
    });

    // Assignment 3 (Networks) - Open, Pending Submission
    const assignment3 = await Assignment.create({
      section: secNet._id,
      doctor: drHassan._id,
      title: 'الواجب الثالث: محاكاة شبكة VLAN وبروتوكول OSPF في Packet Tracer',
      description: 'إعداد شبكة محلية موزعة مع تقسيم الـ Subnets وتطبيق جدول التوجيه الديناميكي',
      deadline: new Date(nowTime + 9 * 24 * 60 * 60 * 1000),
      maxScore: 10,
      allowLate: true
    });

    // Assignment 4 (Operating Systems) - Open, Pending Submission
    const assignment4 = await Assignment.create({
      section: secOS._id,
      doctor: drAli._id,
      title: 'الواجب الرابع: محاكاة جدولة المعالج بخوارزمية Round Robin',
      description: 'حساب متوسط وقت الانتظار Average Waiting Time ووقت التنفيذ Turnaround Time للعمليات',
      deadline: new Date(nowTime + 12 * 24 * 60 * 60 * 1000),
      maxScore: 10,
      allowLate: false
    });

    // ─────────────────────────────────────────────
    // 8. Exams & Academic Grades
    // ─────────────────────────────────────────────
    console.log('[10/10] Seeding Real Exams (Quizzes, Midterms, Finals) & Grading...');

    // Past Graded Quiz 1 (Data Structures)
    const examQuizDS = await Exam.create({
      section: secDS._id,
      doctor: drAli._id,
      title: 'الاختبار القصير الأول: تعقيد الخوارزميات (Quiz 1)',
      type: EXAM_TYPES.QUIZ,
      examDate: new Date(nowTime - 5 * 24 * 60 * 60 * 1000),
      maxScore: 100,
      weightPercentage: 10
    });

    await Grade.create({
      student: stdAymen._id,
      section: secDS._id,
      exam: examQuizDS._id,
      score: 94,
      notes: 'إجابة ممتازة وشرح دقيق للـ Big-O',
      gradedBy: drAli._id,
      isApproved: true
    });

    // Past Graded Quiz 1 (Databases)
    const examQuizDB = await Exam.create({
      section: secDB._id,
      doctor: drSara._id,
      title: 'الاختبار القصير الأول: لغة SQL ومفاهيم DDL/DML',
      type: EXAM_TYPES.QUIZ,
      examDate: new Date(nowTime - 3 * 24 * 60 * 60 * 1000),
      maxScore: 100,
      weightPercentage: 10
    });

    await Grade.create({
      student: stdAymen._id,
      section: secDB._id,
      exam: examQuizDB._id,
      score: 88,
      notes: 'إجابة دقيقة في استعلامات Group By',
      gradedBy: drSara._id,
      isApproved: true
    });

    // Upcoming Midterm 1 (Data Structures)
    const examMidtermDS = await Exam.create({
      section: secDS._id,
      doctor: drAli._id,
      title: 'امتحان منتصف الفصل الدراسي: هياكل البيانات (Midterm)',
      type: EXAM_TYPES.MIDTERM,
      examDate: new Date(nowTime + 11 * 24 * 60 * 60 * 1000),
      startTime: '09:00',
      durationMinutes: 90,
      location: 'قاعة الخوارزمي المركزية',
      maxScore: 100,
      weightPercentage: 30,
      instructions: 'يمنع إدخال الأجهزة الإلكترونية. الحضور قبل الموعد بـ 15 دقيقة.'
    });

    // Upcoming Midterm 2 (Networks)
    const examMidtermNet = await Exam.create({
      section: secNet._id,
      doctor: drHassan._id,
      title: 'امتحان منتصف الفصل: شبكات الحاسوب (Midterm)',
      type: EXAM_TYPES.MIDTERM,
      examDate: new Date(nowTime + 15 * 24 * 60 * 60 * 1000),
      startTime: '10:30',
      durationMinutes: 90,
      location: 'مختبر الشبكات 1 وقاعة 202',
      maxScore: 100,
      weightPercentage: 30,
      instructions: 'يشمل الجانبين النظري والتطبيقي لبروتوكولات التوجيه.'
    });

    // Scheduled Final Exam (Databases)
    const examFinalDB = await Exam.create({
      section: secDB._id,
      doctor: drSara._id,
      title: 'الامتحان النهائي الشامل: نظم قواعد البيانات (Final Exam)',
      type: EXAM_TYPES.FINAL,
      examDate: new Date(nowTime + 40 * 24 * 60 * 60 * 1000),
      startTime: '08:30',
      durationMinutes: 180,
      location: 'القاعة الامتحانية الكبرى - كلية الهندسة',
      maxScore: 100,
      weightPercentage: 50,
      instructions: 'الامتحان النهائي الموحد بإشراف اللجنة الامتحانية المركزية.'
    });

    // Questions in Q&A Wall
    await Question.create([
      {
        section: secDS._id,
        student: stdAymen._id,
        questionText: 'دكتور، في خوارزمية الحذف من شجرة البحث BST، هل نستبدل العقدة بأكبر قيمة في الفرع الأيسر أم بأصغر قيمة في الأيمن؟',
        answerText: 'كلا الطريقتين صحيحتان تماماً وتضمنان الحفاظ على خاصية الترتيب في شجرة البحث الثنائية.',
        isAnswered: true,
        answeredAt: new Date(),
        answeredBy: drAli._id
      },
      {
        section: secNet._id,
        student: stdAymen._id,
        questionText: 'هل يشمل امتحان الشبكات النصفي خوارزمية Dijkstra في بروتوكول OSPF؟',
        answerText: 'نعم، يشمل الجانب النظري لكيفية بناء جدول التوجيه عبر خوارزمية أقصر مسار SPF.',
        isAnswered: true,
        answeredAt: new Date(),
        answeredBy: drHassan._id
      }
    ]);

    // Announcements
    await Announcement.create([
      {
        title: 'جدول امتحانات منتصف الفصل الدراسي (Midterm) للعام 2025/2026',
        content: 'تعلن عمادة كلية الهندسة في الجامعة المستنصرية عن نشر جداول الامتحانات الفصلية لجميع الأقسام العلمية.',
        author: admin._id,
        isGeneral: true
      },
      {
        title: 'إعلان موعد تسليم مشاريع ومختبرات شبكات الحاسوب',
        content: 'يرجى من جميع الطلبة الالتزام بمواعيد تسليم ملفات محاكاة Packet Tracer عبر البوابة الإلكترونية قبل موعد الإغلاق.',
        author: drHassan._id,
        isGeneral: false
      }
    ]);

    // Notifications for Aymen
    await Notification.create([
      {
        recipient: stdAymen._id,
        title: 'تم نشر درجات الاختبار القصير 1',
        message: 'حصلت على درجة 94/100 في اختبار هياكل البيانات.',
        type: 'GRADE',
        refId: examQuizDS._id,
        priority: 'NORMAL'
      },
      {
        recipient: stdAymen._id,
        title: 'واجب دراسي جديد بانتظار الحل',
        message: 'أضافت الدكتورة سارة تكليفاً جديداً في مادة قواعد البيانات.',
        type: 'GENERAL',
        refId: assignment2._id,
        priority: 'HIGH'
      }
    ]);

    console.log('───────────────────────────────────────────────────────');
    console.log('🎉 SEEDING COMPLETED SUCCESSFULLY WITH RICH REAL DATA!');
    console.log('───────────────────────────────────────────────────────');
    console.log('📊 Summary of Seeded Academic Load:');
    console.log('   📚 5 Core Courses (15 Credit Hours)');
    console.log('   🏫 5 Class Sections with Weekly Schedules');
    console.log('   📅 15 Real Attendance Sessions (~93.3% Attendance Rate)');
    console.log('   📝 4 Comprehensive Assignments Across Subjects');
    console.log('   🏆 5 Real Exams (Quizzes, Midterms, Final Exam)');
    console.log('   📁 5 Course Materials with Real Attachments');
    console.log('───────────────────────────────────────────────────────');
    console.log('🔑 Credentials for Quick Testing:');
    console.log('   👤 Admin:   admin@uomustansiriyah.edu.iq    | Password: Password123');
    console.log('   👨‍🏫 Doctor:  dr.ali@uomustansiriyah.edu.iq   | Password: Password123');
    console.log('   👨‍🏫 Doctor:  dr.sara@uomustansiriyah.edu.iq  | Password: Password123');
    console.log('   👨‍🏫 Doctor:  dr.hassan@uomustansiriyah.edu.iq| Password: Password123');
    console.log('   🎓 Student: aymen@uomustansiriyah.edu.iq    | Password: Password123');
    console.log('───────────────────────────────────────────────────────');

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding Failed:', error);
    process.exit(1);
  }
};

seedData();
