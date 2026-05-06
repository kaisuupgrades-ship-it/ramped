/**
 * Founder + team profiles. Used on /about, in the team section, in JSON-LD
 * Person schema for SEO, and as account-manager labels in the client portal.
 */

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  shortRole: string;          // for compact placements ("CEO" vs "Co-Founder & CEO")
  photo: string;              // /assets/team/...
  photoFocal?: string;        // CSS object-position
  bio: string[];              // paragraphs
  tags: string[];
  prev?: string;              // "Xtractor Depot"
  basedIn?: string;           // "Los Angeles, CA"
  email: string;
}

export const team: TeamMember[] = [
  {
    id: "andrew-yoon",
    name: "Andrew Yoon",
    role: "Co-Founder & CEO",
    shortRole: "CEO",
    photo: "/assets/team/andrew.jpg",
    photoFocal: "center 32%",
    bio: [
      "Andrew founded Xtractor Depot in 2016 and grew it into a multi-industry supplier of precision lab equipment, with clients ranging from cannabis operators to SpaceX and Lucid Motors. He started his entrepreneurial journey in college and graduated from Saint Louis University with an accounting degree.",
      "Running a fast-scaling physical-goods business made one gap obvious: nobody was building and running AI automation for operating companies on an ongoing basis. That insight became Ramped AI.",
      "Outside the office, Andrew plays ice hockey, golf, tennis, and paintball. He lives in Los Angeles County with his wife Steph and their dogs.",
    ],
    tags: ["Operations", "B2B Sales", "Manufacturing", "AI Strategy"],
    prev: "Xtractor Depot",
    basedIn: "Los Angeles, CA",
    email: "jon@30dayramp.com",
  },
  {
    id: "jonathan-roh",
    name: "Jonathan Roh",
    role: "Co-Founder & COO",
    shortRole: "COO",
    photo: "/assets/team/jonathan.jpg",
    photoFocal: "center 32%",
    bio: [
      "A University of Missouri Trulaske College of Business grad and Dean's List honoree, Jonathan started his career in commercial banking. He spent years across the desk from owner-operators in manufacturing, distribution, and professional services.",
      "After hundreds of those conversations, he kept seeing the same pattern. Manual workflows eating hours every week. Customer responses going out late. Businesses ready to scale getting held back by their own ops. That was the insight that pushed him to co-found Ramped AI alongside Andrew.",
      "As COO, Jonathan runs the day-to-day on client delivery and makes sure every implementation goes autonomous from week one. He's a Missouri native and lives in the Chesterfield area.",
    ],
    tags: ["Operations", "Client Delivery", "Banking & Finance", "Process Design"],
    basedIn: "Chesterfield, MO",
    email: "jon@30dayramp.com",
  },
  {
    id: "abby-im",
    name: "Abby Im",
    role: "Marketing Lead",
    shortRole: "Marketing",
    photo: "/assets/team/abby.jpg",
    photoFocal: "center 28%",
    bio: [
      "A UCLA Communication grad, Abby spent her early career running brand and content at two DTC startups. She came out of it with one stubborn belief: great marketing is mostly just real customer stories, told well.",
      "She moved into B2B as the demand-gen lead at a Series B fintech, where she rebuilt the inbound funnel from scratch and tripled qualified pipeline in eighteen months. That's where she ran into the operator-level pain Ramped AI now solves.",
      "At Ramped AI, Abby owns brand and demand. The website, the case studies, every customer story we ship. She lives in San Diego, where weekends usually mean surfing Pacific Beach or shooting film on her Leica.",
    ],
    tags: ["Brand", "Demand Gen", "Content", "B2B"],
    basedIn: "San Diego, CA",
    email: "jon@30dayramp.com",
  },
];

export const founderNote = {
  attribution: "Andrew Yoon",
  paragraphs: [
    'I spent ten years running operating businesses. Distribution, fulfillment, e-commerce. The kind of company where one person wears six hats and "automation" usually means "another spreadsheet."',
    "In 2024, I started using AI agents inside Xtractor Depot, my industrial-equipment business. The results were absurd. Quote turnaround dropped from 3 days to 8 minutes. We saved 14 hours a week on inventory work. By month three I'd freed up enough capacity to hire a salesperson instead of an admin.",
    "Naturally, every operator I knew asked me to build them the same thing. So I did. And I noticed every consultant they'd already hired had given them strategy. Slide decks, frameworks, north stars. But no working software.",
    "Ramped AI is the company we wish had existed. We don't sell roadmaps. We build, deploy, and run the agents on a flat monthly fee. If they aren't live in 30 days, you don't pay.",
  ],
};
