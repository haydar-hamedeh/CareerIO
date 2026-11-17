import { cipMajors } from "./majors-cip";

export type Option = { value: string; group: string };

const group = (name: string, values: string[]): Option[] => values.map((value) => ({ value, group: name }));

export const degrees: Option[] = [
  ...group("School & technical", [
    "High school diploma",
    "International Baccalaureate (IB)",
    "A-Levels",
    "GED",
    "Vocational / technical diploma",
    "Higher National Diploma (HND)",
  ]),
  ...group("Undergraduate", [
    "Associate degree",
    "Bachelor of Arts (BA)",
    "Bachelor of Science (BSc)",
    "Bachelor of Engineering (BE)",
    "Bachelor of Business Administration (BBA)",
    "Bachelor of Fine Arts (BFA)",
    "Bachelor of Architecture (BArch)",
    "Bachelor of Laws (LLB)",
    "Bachelor of Education (BEd)",
    "Bachelor of Nursing (BSN)",
    "Licence",
  ]),
  ...group("Postgraduate", [
    "Master of Arts (MA)",
    "Master of Science (MSc)",
    "Master of Engineering (ME)",
    "Master of Business Administration (MBA)",
    "Master of Laws (LLM)",
    "Master of Education (MEd)",
    "Master of Public Health (MPH)",
    "Master 1",
    "Master 2",
    "Postgraduate diploma",
  ]),
  ...group("Doctorate & professional", [
    "Doctor of Philosophy (PhD)",
    "Doctor of Medicine (MD)",
    "Doctor of Pharmacy (PharmD)",
    "Doctor of Dental Surgery (DDS)",
    "Doctor of Veterinary Medicine (DVM)",
  ]),
  ...group("Other learning", ["Professional certificate", "Bootcamp", "Online course", "Self-taught"]),
];

const popularMajors: Option[] = [
  ...group("Computing & IT", [
    "Computer Science", "Software Engineering", "Computer Engineering", "Information Technology",
    "Information Systems", "Data Science", "Artificial Intelligence", "Cybersecurity", "Computer Networks",
    "Game Development", "Web Development", "Management Information Systems",
  ]),
  ...group("Engineering", [
    "Civil Engineering", "Mechanical Engineering", "Electrical Engineering", "Electronics Engineering",
    "Communications Engineering", "Chemical Engineering", "Industrial Engineering", "Mechatronics",
    "Biomedical Engineering", "Petroleum Engineering", "Environmental Engineering", "Aerospace Engineering",
    "Architecture", "Interior Architecture", "Urban Planning",
  ]),
  ...group("Business & economics", [
    "Business Administration", "Accounting", "Finance", "Banking", "Economics", "Marketing", "Management",
    "Human Resources", "International Business", "Entrepreneurship", "Supply Chain & Logistics",
    "Hospitality Management", "Tourism Management", "Business Analytics", "Actuarial Science",
  ]),
  ...group("Health & medicine", [
    "Medicine", "Nursing", "Pharmacy", "Dentistry", "Public Health", "Nutrition & Dietetics",
    "Physiotherapy", "Medical Laboratory Science", "Radiology", "Midwifery", "Occupational Therapy",
    "Speech Therapy", "Veterinary Medicine", "Health Management",
  ]),
  ...group("Science & mathematics", [
    "Mathematics", "Statistics", "Physics", "Chemistry", "Biology", "Biochemistry", "Biotechnology",
    "Environmental Science", "Geology", "Food Science", "Agriculture",
  ]),
  ...group("Design & arts", [
    "Graphic Design", "UX / UI Design", "Interior Design", "Fashion Design", "Product Design",
    "Fine Arts", "Animation", "Photography", "Film & Television", "Music", "Theatre",
  ]),
  ...group("Media & communication", [
    "Journalism", "Mass Communication", "Public Relations", "Advertising", "Digital Media", "Radio & TV",
  ]),
  ...group("Social sciences & humanities", [
    "Psychology", "Sociology", "Political Science", "International Relations", "Social Work", "History",
    "Philosophy", "Geography", "Archaeology", "Anthropology", "Translation", "English Literature",
    "Arabic Literature", "French Literature", "Linguistics",
  ]),
  ...group("Education", [
    "Education", "Early Childhood Education", "Elementary Education", "Special Education",
    "Educational Technology", "Teaching English as a Foreign Language",
  ]),
  ...group("Law", ["Law", "International Law", "Business Law"]),
];

// Popular majors first (hand-curated names), then the full CIP list for everything else.
const popularKeys = new Set(popularMajors.map((m) => m.value.toLowerCase()));
export const majors: Option[] = [
  ...popularMajors,
  ...cipMajors.filter((m) => !popularKeys.has(m.value.toLowerCase())).map((m) => ({ value: m.value, group: m.group })),
];

/** Skill field id for a major picked from the CIP list (lowercase major name -> field id). */
export const majorField = new Map(cipMajors.filter((m) => m.field).map((m) => [m.value.toLowerCase(), m.field as string]));
