export type YearMonth = readonly [year: number, month: number];

export interface Objective {
  readonly title?: string;
  readonly text: string;
}

export interface PlanetHue {
  readonly hi: string;
  readonly base: string;
  readonly lo: string;
  readonly glow: string;
}

export interface Mission {
  readonly id: string;
  readonly company: string;
  readonly via?: string;
  readonly role: string;
  readonly start: YearMonth;
  readonly end?: YearMonth;
  readonly place: string;
  readonly domain: string;
  readonly summary: string;
  readonly intro?: string;
  readonly metric?: { readonly value: string; readonly label: string };
  readonly objectives: readonly Objective[];
  readonly stack: readonly string[];
  readonly hue: PlanetHue;
  readonly ring?: boolean;
}

export interface SkillGroup {
  readonly id: string;
  readonly name: string;
  readonly items: readonly string[];
}

export const profile = {
  name: 'Ruslan Postoiuk',
  title: 'Software Engineer · Backend & AI',
  lead: 'I build AI-powered backend systems and the production infrastructure that serves them at scale — turning document intelligence, dynamic pricing and recommendation engines into reliable, revenue-driving services on Node.js and AWS.',
  email: 'ruslanpostoiuk@gmail.com',
  linkedin: { label: 'in/ruslan-postoiuk', url: 'https://www.linkedin.com/in/ruslan-postoiuk' },
  github: { label: 'LappA17', url: 'https://github.com/LappA17' },
  careerStart: [2019, 11] as YearMonth,
  languages: ['English', 'Polish', 'Ukrainian', 'Russian'],
  education: {
    degree: 'Bachelor’s degree',
    school: 'Jan Kochanowski University of Kielce',
    start: [2017, 10] as YearMonth,
    end: [2021, 5] as YearMonth,
  },
  cvFile: 'Ruslan_Postoiuk_CV.pdf',
} as const;

export const missions: readonly Mission[] = [
  {
    id: 'simpol',
    company: 'Simpol E-commerce',
    role: 'Backend Engineer',
    start: [2019, 11],
    end: [2022, 5],
    place: 'Poland',
    domain: 'Affiliate-marketing CRM & e-commerce',
    summary: 'Backend services on Node.js, NestJS and TypeScript on AWS.',
    objectives: [
      { text: 'Backend engineer on an affiliate-marketing CRM system and an e-commerce online shop.' },
      { text: 'Built and maintained backend services with Node.js, NestJS and TypeScript on AWS.' },
    ],
    stack: ['Node.js', 'NestJS', 'TypeScript', 'AWS'],
    hue: { hi: '#ffe3d6', base: '#e07b58', lo: '#5a2413', glow: 'rgba(224,123,88,0.35)' },
  },
  {
    id: 'listonic',
    company: 'Listonic',
    role: 'Full Stack Developer',
    start: [2022, 5],
    end: [2022, 12],
    place: 'Kielce, Poland',
    domain: 'Smart shopping-list app & grocery store',
    summary: 'Full-stack Node.js / React on the Listonic app and the Lisek grocery store.',
    objectives: [
      { text: 'Full-stack Node.js / React development with CRUD operations and hands-on database management.' },
      { text: 'Contributed to the Lisek grocery store and the Listonic smart shopping-list app.' },
    ],
    stack: ['Node.js', 'React', 'CRUD APIs', 'Database management'],
    hue: { hi: '#e8f1ff', base: '#7fa8f6', lo: '#1d336b', glow: 'rgba(127,168,246,0.35)' },
  },
  {
    id: 'stonly',
    company: 'Stonly',
    role: 'Software Engineer',
    start: [2022, 12],
    end: [2023, 11],
    place: 'Cracow, Poland · On-site',
    domain: 'Interactive guides & knowledge-base SaaS',
    summary: 'Zero-downtime migrations, an API test framework from scratch, clean-architecture refactors.',
    objectives: [
      { title: 'Complex business logic', text: 'Delivered features with complex business logic in close coordination with an international business team.' },
      { title: 'Zero-downtime migrations', text: 'Designed and performed zero-downtime data migrations on high-volume production environments.' },
      { title: 'API test framework', text: 'Introduced and built an API test framework from scratch — architecture designed to run across all environments.' },
      { title: 'Clean architecture', text: 'Refactored legacy code into a clean architecture (SOLID, GRASP, GoF) and introduced feature flags.' },
    ],
    stack: ['Data migrations', 'API testing', 'Feature flags', 'SOLID · GRASP · GoF'],
    hue: { hi: '#dcfff7', base: '#4fc6b4', lo: '#12463f', glow: 'rgba(79,198,180,0.32)' },
  },
  {
    id: 'flip',
    company: 'Flip',
    role: 'Software Engineer',
    start: [2023, 11],
    end: [2025, 5],
    place: 'Remote',
    domain: 'Social-commerce platform',
    summary: 'Recommendation and AI-serving infrastructure for a TikTok-style feed at 500k+ req/s.',
    intro: 'A $1B+ social-commerce product running at 500k+ requests per second across 400+ microservices, with a 100-strong backend team.',
    metric: { value: '500k+', label: 'requests per second, 400+ microservices' },
    objectives: [
      { title: 'Personalized feed', text: 'Worked extensively with AWS Personalize, SageMaker, Athena and OpenSearch to build the recommendation / personalization system and AI-serving infrastructure that delivered best-matched posts to users (TikTok-style feed).' },
      { title: 'A microservice, end to end', text: 'Built a microservice end-to-end — from architecture design to deploying the pod in Kubernetes — and owned quality analysis of the data feeding the personalization system.' },
      { title: 'Search pipeline', text: 'Managed Elasticsearch speed / batch processors and the reindexer.' },
    ],
    stack: ['AWS Personalize', 'SageMaker', 'Athena', 'OpenSearch', 'Elasticsearch', 'Kubernetes', 'Microservices'],
    hue: { hi: '#f1e6ff', base: '#a985f6', lo: '#35216b', glow: 'rgba(169,133,246,0.35)' },
  },
  {
    id: 'caronsale',
    company: 'CarOnSale',
    via: 'via Exadel',
    role: 'Software Engineer',
    start: [2025, 5],
    place: 'Remote',
    domain: 'Automotive B2B auction platform',
    summary: 'Project / epic owner: AI report parser, AI dynamic pricing, OEM public API.',
    intro: 'Project / epic owner — led each initiative end-to-end, from technical design and stakeholder alignment through delivery and production rollout.',
    metric: { value: '10,000+', label: 'inspector vehicle reports parsed by AI every month' },
    objectives: [
      { title: 'AI Report Parser', text: 'Led development of an AI-powered parser that ingests and maps 10,000+ inspector vehicle PDF reports per month into our domain model, removing a major manual data-entry bottleneck.' },
      { title: 'AI Dynamic Pricing', text: 'Owned the integration of an ML pricing model that replaced static, hardcoded auction-fee tiers with data-driven fees based on auction, buyer and vehicle signals.' },
      { title: 'Public API (OEM integrations)', text: 'Architected and delivered the public API powering integrations with Mercedes-Benz Italy and Volkswagen, letting major partners plug directly into the auction platform.' },
      { title: 'Mercedes-Benz Germany integration', text: 'Drove a dedicated integration flow, adapting our system to MB Germany’s requirements.' },
      { title: 'Auction Fees Refactor', text: 'Sole owner of the auction commission / fee logic, rebuilt from the ground up.' },
      { title: 'Min Ask Price Refactor', text: 'Led the refactor that unified minimum-ask-price visibility and behaviour across auctions, resolving inconsistent buyer-facing rules.' },
    ],
    stack: ['Node.js', 'TypeScript', 'PostgreSQL', 'RabbitMQ', 'AWS', 'AI document parsing', 'ML pricing', 'Public API design', 'Claude Code · MCP'],
    hue: { hi: '#fff4d8', base: '#f0b85f', lo: '#6a4112', glow: 'rgba(240,184,95,0.4)' },
    ring: true,
  },
];

export const skills: readonly SkillGroup[] = [
  {
    id: 'backend',
    name: 'Backend',
    items: ['TypeScript', 'Node.js', 'NestJS', 'Fastify', 'Public API design', 'gRPC / Protobuf', 'RabbitMQ', 'Kafka', 'Node.js worker threads', 'Microservices & Monolith', 'Domain-Driven Design', 'CQRS'],
  },
  { id: 'databases', name: 'Databases', items: ['PostgreSQL', 'MySQL', 'MongoDB', 'ClickHouse', 'Redis', 'Elasticsearch / Kibana'] },
  { id: 'cloud', name: 'Cloud & Infra', items: ['AWS', 'Docker', 'Kubernetes', 'Nginx', 'S3', 'Grafana', 'Datadog'] },
  { id: 'ai', name: 'AI & ML Integration', items: ['AWS Personalize', 'SageMaker', 'OpenSearch', 'Recommender systems', 'AI document parsing', 'AI dynamic pricing'] },
  { id: 'ai-dev', name: 'AI-Assisted Development', items: ['Claude Code', 'Custom skills & plugins', 'MCP servers', 'Automated QA'] },
  { id: 'delivery', name: 'Testing & Delivery', items: ['CI/CD', 'Cypress', 'Integration testing', 'API testing'] },
];
