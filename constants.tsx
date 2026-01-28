
import { JobDemand, Candidate, CandidateStatus } from './types';

export const INITIAL_JOBS: JobDemand[] = [
  {
    id: 'job-1',
    title: '高级前端工程师',
    department: '研发部',
    description: '负责公司核心产品的前端架构与开发...',
    platforms: ['智联招聘', 'BOSS直聘', 'LinkedIn'],
    createDate: '2023-11-20',
    status: 'OPEN',
    type: 'FULL_TIME'
  },
  {
    id: 'job-2',
    title: '资深产品经理',
    department: '产品部',
    description: '深度挖掘用户需求，负责B端产品生命周期管理...',
    platforms: ['BOSS直聘', '猎聘'],
    createDate: '2023-12-01',
    status: 'OPEN',
    type: 'FULL_TIME'
  },
  {
    id: 'job-3',
    title: '前端开发实习生',
    department: '研发部',
    description: '协助参与公司内部系统的日常维护与组件库开发...',
    platforms: ['牛客网', 'BOSS直聘'],
    createDate: '2023-12-10',
    status: 'OPEN',
    type: 'INTERN'
  }
];

export const INITIAL_CANDIDATES: Candidate[] = [
  {
    id: 'c-1',
    name: '张伟',
    jobId: 'job-1',
    source: 'BOSS直聘',
    status: CandidateStatus.INTERVIEW_2,
    stageStatus: 'PENDING',
    isHighPotential: true,
    contactInfo: '138-0000-0001',
    interviews: [
      { stage: '一面', date: '2023-12-05', interviewer: '前端Leader', feedback: '技术扎实，沟通顺畅', passed: true }
    ],
    notes: [
      { id: 'n-1', text: '背景非常优秀，目前在看机会', timestamp: '2023-12-05 14:30' }
    ]
  },
  {
    id: 'c-2',
    name: '李芳',
    jobId: 'job-1',
    source: '智联招聘',
    status: CandidateStatus.LM_REVIEW,
    stageStatus: 'APPROVED',
    isHighPotential: false,
    contactInfo: '139-0000-0002',
    interviews: [],
    notes: [
      { id: 'n-2', text: '简历已初筛，等待LM回复', timestamp: '2023-12-06 10:15' }
    ]
  },
  {
    id: 'c-3',
    name: '王强',
    jobId: 'job-2',
    source: '猎聘',
    status: CandidateStatus.BACKUP,
    stageStatus: 'PENDING',
    isHighPotential: true,
    contactInfo: '137-0000-0003',
    interviews: [
      { stage: '一面', date: '2023-11-25', interviewer: '产品总监', feedback: '经验匹配度高，但由于项目变动暂时无法入职', passed: true }
    ],
    notes: [
      { id: 'n-3', text: '重点人才，可后续关注', timestamp: '2023-11-25 16:45' }
    ]
  }
];

export const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  [CandidateStatus.NEW]: { label: '初步筛选', color: 'bg-slate-200 text-slate-700' },
  [CandidateStatus.SCREENED]: { label: '已筛选', color: 'bg-blue-100 text-blue-700' },
  // [CandidateStatus.CONTACTED]: { label: '已初聊', color: 'bg-indigo-100 text-indigo-700' },
  [CandidateStatus.LM_REVIEW]: { label: '发给LM', color: 'bg-amber-100 text-amber-700' },
  [CandidateStatus.LM_APPROVED]: { label: 'LM已确认', color: 'bg-orange-100 text-orange-700' },
  [CandidateStatus.INTERVIEW_1]: { label: '一面', color: 'bg-purple-100 text-purple-700' },
  [CandidateStatus.INTERVIEW_2]: { label: '二面', color: 'bg-fuchsia-100 text-fuchsia-700' },
  [CandidateStatus.INTERVIEW_3]: { label: '三面', color: 'bg-pink-100 text-pink-700' },
  [CandidateStatus.OFFER]: { label: '入职确认', color: 'bg-green-100 text-green-700' },
  [CandidateStatus.HIRED]: { label: '已入职', color: 'bg-emerald-600 text-white' },
  [CandidateStatus.REJECTED]: { label: '淘汰', color: 'bg-red-100 text-red-700' },
  [CandidateStatus.BACKUP]: { label: '人才储备', color: 'bg-cyan-100 text-cyan-700' },
};
