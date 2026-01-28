import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";

// Always use the process.env.API_KEY directly as a named parameter.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export interface JDAnalysis {
  skills: string[];
  painPoints: string;
  evaluationTips: string[];
}

export interface InterviewQuestion {
  question: string;
  purpose: string;
}

export interface TalentMatchResult {
  candidateId: string;
  matchScore: number;
  reason: string;
}

export interface ParsedResume {
  name: string;
  contactInfo: string;
}

/**
 * Analyzes a Job Description using Gemini and extracts key insights.
 */
export const analyzeJD = async (jdText: string): Promise<JDAnalysis> => {
  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `分析以下职位描述(JD)，并提取出：
      1. 核心技能关键词
      2. 岗位难点
      3. 筛选简历时的关键评估点
      JD内容：${jdText}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            skills: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING },
              description: "核心技能关键词"
            },
            painPoints: { 
              type: Type.STRING,
              description: "岗位难点"
            },
            evaluationTips: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING },
              description: "筛选简历时的关键评估点"
            }
          },
          propertyOrdering: ["skills", "painPoints", "evaluationTips"]
        }
      }
    });
    const jsonStr = response.text?.trim() || '{}';
    return JSON.parse(jsonStr) as JDAnalysis;
  } catch (error) {
    console.error("Gemini Analyze Error:", error);
    return { skills: [], painPoints: "", evaluationTips: [] };
  }
};

/**
 * Matches a list of candidates from the talent pool to a specific job description.
 */
export const matchTalentToJob = async (jobTitle: string, jdText: string, candidates: {id: string, name: string, notes: string}[]): Promise<TalentMatchResult[]> => {
  try {
    if (candidates.length === 0) return [];
    
    const candidatesStr = candidates.map(c => `ID: ${c.id}, 姓名: ${c.name}, 备注: ${c.notes}`).join('\n');
    
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `你是一个资深HR。请根据以下职位信息和人才储备库中的候选人信息，选出最匹配的3位候选人。
      
      职位名称: ${jobTitle}
      职位描述: ${jdText}
      
      候选人列表:
      ${candidatesStr}
      
      请给出每个人的匹配分数(0-100)和简短的匹配理由。`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              candidateId: { type: Type.STRING },
              matchScore: { type: Type.NUMBER },
              reason: { type: Type.STRING }
            },
            required: ["candidateId", "matchScore", "reason"]
          }
        }
      }
    });
    
    const jsonStr = response.text?.trim() || '[]';
    return JSON.parse(jsonStr) as TalentMatchResult[];
  } catch (error) {
    console.error("Gemini Matching Error:", error);
    return [];
  }
};

/**
 * Parses resume file to extract name and contact info.
 */
export const parseResumeData = async (fileBase64: string, mimeType: string): Promise<ParsedResume | null> => {
  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          inlineData: {
            data: fileBase64,
            mimeType: mimeType
          }
        },
        {
          text: "请从这份简历中提取候选人的姓名和联系方式（电话或邮箱）。如果找不到，请返回空字符串。"
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING, description: "候选人姓名" },
            contactInfo: { type: Type.STRING, description: "联系方式" }
          },
          required: ["name", "contactInfo"]
        }
      }
    });

    const jsonStr = response.text?.trim() || '{}';
    return JSON.parse(jsonStr) as ParsedResume;
  } catch (error) {
    console.error("Resume Parsing Error:", error);
    return null;
  }
};

/**
 * Generates interview questions for a specific job and stage.
 */
export const generateInterviewQuestions = async (jdTitle: string, stage: string): Promise<InterviewQuestion[]> => {
  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `针对职位 "${jdTitle}" 的 ${stage} 面试，请生成5个高质量的问题及其考核重点。`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              question: { type: Type.STRING },
              purpose: { type: Type.STRING }
            },
            propertyOrdering: ["question", "purpose"]
          }
        }
      }
    });
    const jsonStr = response.text?.trim() || '[]';
    return JSON.parse(jsonStr) as InterviewQuestion[];
  } catch (error) {
    console.error("Gemini Questions Error:", error);
    return [];
  }
};