// Shared field definitions for the generators: ISCO prefixes select ESCO occupations, match words infer a person's field.

export type Field = { id: string; label: string; isco: string[]; match: string[] };

// match = lowercase words/phrases found in a degree, field of study or role title that point to this field.
export const FIELDS: Field[] = [
  { id: "cs", label: "Computer Science & IT", isco: ["251", "252", "351", "352", "133"], match: ["computer", "software", "information technology", "informatics", "programming", "developer", "data science", "cyber", "artificial intelligence", "machine learning", "devops", "web", "mobile", "network", "database", "it "] },
  { id: "engineering", label: "Engineering", isco: ["214", "215", "311", "312", "313", "315"], match: ["engineer", "mechanical", "electrical", "electronics", "chemical", "industrial", "petroleum", "mechatronics", "biomedical", "telecom"] },
  { id: "construction", label: "Architecture & Construction", isco: ["216", "1323", "3112", "3123", "711", "712", "713", "741"], match: ["architect", "civil", "construction", "interior", "urban planning", "surveying", "quantity"] },
  { id: "finance", label: "Finance & Accounting", isco: ["241", "331", "431", "2631", "1211", "3321"], match: ["finance", "accounting", "accountant", "banking", "economics", "economist", "audit", "tax", "treasury", "investment", "actuar", "insurance"] },
  { id: "business", label: "Business & Management", isco: ["121", "122", "123", "242", "332", "333", "334", "411", "412"], match: ["business", "management", "administration", "mba", "entrepreneur", "operations", "project manag", "product manag", "consult", "strategy"] },
  { id: "marketing", label: "Marketing & Communications", isco: ["243", "1221", "1222", "2432"], match: ["marketing", "advertising", "public relations", "communication", "brand", "seo", "social media", "content"] },
  { id: "sales", label: "Sales & Customer Service", isco: ["52", "42", "3322", "3323"], match: ["sales", "customer service", "customer success", "retail", "account executive", "call center", "business development"] },
  { id: "health", label: "Healthcare & Medicine", isco: ["221", "222", "225", "226", "321", "322", "325", "134"], match: ["medicine", "medical", "nursing", "nurse", "pharmacy", "pharmacist", "dental", "dentist", "health", "physician", "doctor", "physiotherap", "radiolog", "laboratory", "nutrition"] },
  { id: "education", label: "Education & Training", isco: ["231", "232", "233", "234", "235"], match: ["education", "teaching", "teacher", "pedagog", "tutor", "school", "curriculum", "instruction", "training"] },
  { id: "law", label: "Law & Public Policy", isco: ["261", "3411", "2422", "111"], match: ["law", "legal", "lawyer", "paralegal", "policy", "political", "public administration", "international relations", "compliance"] },
  { id: "design", label: "Design & Creative Arts", isco: ["2163", "2166", "265", "343"], match: ["design", "graphic", "ux", "ui ", "fine art", "illustration", "animation", "fashion", "photograph", "film", "creative"] },
  { id: "media", label: "Media & Journalism", isco: ["264", "3521"], match: ["journalism", "journalist", "media", "broadcast", "editor", "writer", "translation", "translator", "linguistic", "publishing"] },
  { id: "science", label: "Science & Research", isco: ["211", "212", "213", "3141"], match: ["science", "biology", "chemistry", "physics", "mathematics", "statistics", "research", "environmental", "geology", "biotechnology", "agricultur"] },
  { id: "hr", label: "Human Resources", isco: ["2423", "1212", "3333", "2424"], match: ["human resources", "hr ", "recruit", "talent", "people operations", "payroll", "organizational psychology"] },
  { id: "logistics", label: "Logistics & Supply Chain", isco: ["1324", "4321", "4323", "832", "3331", "4322"], match: ["logistics", "supply chain", "procurement", "warehouse", "shipping", "transport", "inventory"] },
  { id: "hospitality", label: "Hospitality & Tourism", isco: ["141", "511", "512", "513", "5151", "3434"], match: ["hospitality", "hotel", "tourism", "travel", "restaurant", "culinary", "chef", "event", "catering"] },
  { id: "social", label: "Psychology & Social Work", isco: ["2632", "2633", "2634", "2635", "3412"], match: ["psychology", "psychologist", "social work", "counsel", "sociology", "anthropology", "therapy", "community"] },
  { id: "trades", label: "Skilled Trades & Manufacturing", isco: ["72", "73", "74", "81", "82", "751"], match: ["technician", "electrician", "plumb", "welding", "mechanic", "manufactur", "carpent", "maintenance", "vocational", "automotive"] },
];
