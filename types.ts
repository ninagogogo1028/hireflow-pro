
export enum CandidateStatus {
  NEW = 'NEW', // 初步筛选
  SCREENED = 'SCREENED', // 已筛选
  // CONTACTED = 'CONTACTED', // Removed as per request
  LM_REVIEW = 'LM_REVIEW', // 发给LM
  LM_APPROVED = 'LM_APPROVED', // LM确定面试
  INTERVIEW_1 = 'INTERVIEW_1', // 一面
  INTERVIEW_2 = 'INTERVIEW_2', // 二面
  INTERVIEW_3 = 'INTERVIEW_3', // 三面
  OFFER = 'OFFER', // 入职确认
  HIRED = 'HIRED', // 已入职
  REJECTED = 'REJECTED', // 不通过
  BACKUP = 'BACKUP' // 人才储备 (Talent Pool)
}

export type JobType = 'FULL_TIME' | 'INTERN';
export type StageStatus = 'PENDING' | 'APPROVED' | 'FAILED';

export interface JobDemand {
  id: string;
  title: string;
  department: string;
  description: string;
  platforms: string[];
  createDate: string;
  status: 'OPEN' | 'CLOSED';
  type: JobType;
}

export interface InterviewRecord {
  stage: string;
  date: string;
  interviewer: string;
  feedback: string;
  passed: boolean;
}

export interface CandidateNote {
  id: string;
  text: string;
  timestamp: string;
}

export interface Candidate {
  id: string;
  name: string;
  jobId?: string;
  source: string;
  status: CandidateStatus;
  stageStatus: StageStatus;
  isHighPotential: boolean;
  resumeUrl?: string;
  resumeFileName?: string;
  contactInfo: string;
  interviews: InterviewRecord[];
  onboardingInfo?: {
    date: string;
    salary: string;
    requiredDocs: string[];
  };
  notes: CandidateNote[]; // Updated to support multiple notes
}

export interface PlatformStats {
  platform: string;
  count: number;
}
