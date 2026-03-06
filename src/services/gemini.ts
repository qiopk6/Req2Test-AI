import { GoogleGenAI, Type } from "@google/genai";

export interface TestCase {
  module: string;
  id: string;
  title: string;
  type: string;
  preconditions: string;
  steps: string[];
  inputData: string;
  expectedResult: string;
  priority: 'High' | 'Medium' | 'Low';
  remarks: string;
}

export interface ImageContent {
  data: string;
  mimeType: string;
}

export async function generateTestCases(
  requirementText: string, 
  images?: ImageContent[], 
  customApiKey?: string,
  modelName: string = "gemini-3-flash-preview"
): Promise<TestCase[]> {
  const apiKey = customApiKey || process.env.GEMINI_API_KEY || '';
  const ai = new GoogleGenAI({ apiKey });
  const model = modelName;
  
  const prompt = `
    你是一名顶级软件测试专家。我将提供整个产品的功能文档、页面设计和接口列表。请帮我生成**极其详尽的全套测试用例矩阵**。
    
    **关键目标：**
    1. **穷尽性测试**：不要只生成几个示例。你需要深入挖掘文档中的每一个功能点、每一个输入框、每一个按钮、每一个接口参数。
    2. **数量要求**：请根据文档复杂度生成尽可能多的用例（目标 30-50 条以上，如果文档复杂则更多）。必须确保覆盖所有模块。
    3. **多维度覆盖：**
       - **前端**：UI交互、表单验证（各种非法输入）、页面跳转、E2E流程、响应式适配。
       - **后端**：所有 API 的请求/响应、必填项、类型校验、权限校验、逻辑校验、异常处理。
       - **场景**：正向流程、负向流程、边界值（极值、空值、超长值）、异常场景（断网、超时、并发、非法操作）。

    **用例结构要求：**
    - 模块名称：清晰标注所属功能块或接口。
    - 用例编号：MOD001_TC001 格式。
    - 用例标题：简洁明确。
    - 测试类型：功能/性能/安全/兼容性/边界值/异常/接口。
    - 前置条件：执行该用例的前提。
    - 测试步骤：步骤必须详细，任何人拿到都能复现。
    - 输入数据：具体的测试数据（如：'admin123', '-1', '超长字符串...'）。
    - 预期结果：明确的成功或失败判定标准。
    - 优先级：High/Medium/Low。
    - 备注：说明该用例设计的意图或注意点。

    **需求文档内容如下：**
    ${requirementText}

    ${images && images.length > 0 ? "此外，我还提供了一些设计图作为参考，请结合设计图中的 UI 细节（如按钮位置、输入框类型、视觉反馈等）来完善测试用例。" : ""}

    请严格按照以上要求，生成一份完整、专业、可直接用于生产环境的测试用例矩阵。
  `;

  const parts: any[] = [{ text: prompt }];
  if (images && images.length > 0) {
    images.forEach(img => {
      parts.push({
        inlineData: {
          mimeType: img.mimeType,
          data: img.data.split(',')[1] || img.data
        }
      });
    });
  }

  try {
    const response = await ai.models.generateContent({
      model,
      contents: { parts },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              module: { type: Type.STRING },
              id: { type: Type.STRING },
              title: { type: Type.STRING },
              type: { type: Type.STRING },
              preconditions: { type: Type.STRING },
              steps: { 
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              inputData: { type: Type.STRING },
              expectedResult: { type: Type.STRING },
              priority: { type: Type.STRING, enum: ["High", "Medium", "Low"] },
              remarks: { type: Type.STRING }
            },
            required: ["module", "id", "title", "type", "preconditions", "steps", "inputData", "expectedResult", "priority", "remarks"]
          }
        }
      }
    });

    if (!response.text) {
      throw new Error("AI 未返回任何内容，请重试。");
    }

    return JSON.parse(response.text);
  } catch (error: any) {
    console.error("Gemini API Error (Test Cases):", error);
    const errorMsg = error.message || "";
    if (errorMsg.includes("Safety")) {
      throw new Error("内容被安全过滤器拦截，请检查您的文档或图片内容。");
    }
    if (errorMsg.includes("429") || errorMsg.includes("RESOURCE_EXHAUSTED") || errorMsg.includes("Quota")) {
      throw new Error("API 请求配额已耗尽或请求过于频繁。请稍后再试，或在设置中配置您自己的 API Key 以获得更高配额。");
    }
    throw new Error(`生成测试用例失败: ${errorMsg || "未知错误"}`);
  }
}

export async function generateXMindContent(
  requirementText: string, 
  images?: ImageContent[], 
  customApiKey?: string,
  modelName: string = "gemini-3-flash-preview"
): Promise<string> {
  const apiKey = customApiKey || process.env.GEMINI_API_KEY || '';
  const ai = new GoogleGenAI({ apiKey });
  const model = modelName;
  
  const prompt = `
    你是一名拥有10年以上经验的软件测试专家，擅长测试分析和测试设计。

    我会提供产品需求文档（PRD）或功能说明，你需要根据需求内容生成 **XMind结构的测试用例思维导图**。

    【目标】

    生成可以直接用于测试执行的思维导图，结构为：

    功能
    测试点
    测试步骤 + 预期结果

    【输出格式】

    必须使用 **Markdown 标题层级结构**，以确保 XMind 导入后能识别为 3 级结构：

    # 功能模块 (第1级)
    ## 测试点名称 (第2级)
    ### 步骤：xxxx \n预期：xxxx (第3级)

    示例格式：

    # 用户登录
    ## 正常登录-用户名密码正确
    ### 步骤：输入正确用户名和密码点击登录\n预期：登录成功并进入首页
    ## 异常登录-密码错误
    ### 步骤：输入正确用户名和错误密码点击登录\n预期：提示“密码错误”

    【测试设计要求】

    每个功能需要覆盖以下测试维度：

    1 功能测试
    2 异常场景
    3 边界值测试
    4 用户误操作
    5 权限测试
    6 网络异常
    7 数据异常
    8 UI交互
    9 接口异常

    【步骤编写规则】

    步骤必须：

    * 简洁
    * 一句话描述
    * 可直接执行

    例如：

    步骤：点击首页推荐短剧
    预期：进入短剧播放页

    不要写：

    ❌ 打开浏览器进入系统然后点击按钮

    【预期结果规则】

    预期结果必须：

    * 明确
    * 可验证
    * 一句话描述

    例如：

    预期：提示“用户名不能为空”
    预期：页面跳转至短剧播放页
    预期：返回错误码401

    【输出规则】

    1 只输出思维导图结构
    2 不需要解释
    3 层级清晰
    4 请保证每个功能生成 8-15 个测试点
    5 步骤与预期尽量简洁（非常重要）
    6 输出内容可以直接复制到 XMind

    **需求文档内容如下：**
    ${requirementText}

    ${images && images.length > 0 ? "此外，我还提供了一些设计图作为参考，请结合设计图中的 UI 细节来完善测试点。" : ""}
  `;

  const parts: any[] = [{ text: prompt }];
  if (images && images.length > 0) {
    images.forEach(img => {
      parts.push({
        inlineData: {
          mimeType: img.mimeType,
          data: img.data.split(',')[1] || img.data
        }
      });
    });
  }

  try {
    const response = await ai.models.generateContent({
      model,
      contents: { parts }
    });

    return response.text || "";
  } catch (error: any) {
    console.error("Gemini API Error (XMind):", error);
    const errorMsg = error.message || "";
    if (errorMsg.includes("Safety")) {
      throw new Error("内容被安全过滤器拦截，请检查您的文档或图片内容。");
    }
    if (errorMsg.includes("429") || errorMsg.includes("RESOURCE_EXHAUSTED")) {
      throw new Error("API 请求配额已耗尽或请求过于频繁。请稍后再试，或在设置中配置您自己的 API Key 以获得更高配额。");
    }
    throw new Error(`生成思维导图失败: ${errorMsg || "未知错误"}`);
  }
}

export async function analyzeRequirements(
  requirementText: string, 
  images?: ImageContent[], 
  customApiKey?: string,
  modelName: string = "gemini-3-flash-preview"
): Promise<{ report: string; revisedDocument: string }> {
  const apiKey = customApiKey || process.env.GEMINI_API_KEY || '';
  const ai = new GoogleGenAI({ apiKey });
  const model = modelName;
    const prompt = `
    请扮演以下角色共同评审需求文档：

    - 资深产品经理
    - 系统架构师
    - QA测试负责人
    - 用户体验设计师

    请对需求文档进行多角色评审，并输出评审报告。

    重点发现：
    1 产品逻辑漏洞
    2 用户体验问题
    3 业务规则缺失
    4 异常场景缺失
    5 接口设计问题
    6 数据设计问题
    7 测试难点
    8 技术风险

    最终输出要求：
    请将输出分为两个部分：
    1. 评审报告：包含需求理解、需求问题清单、风险评估、优化建议。
    2. 修正后的完整需求文档：**这是最关键的部分**。请基于原始需求文档，将评审中发现的问题进行修正，并补充缺失的细节。
       **注意：必须保留原始文档中的所有现有章节、功能描述和细节，严禁进行任何形式的删减或概括。** 
       你需要在保持原貌的基础上进行“增量式”的完善和修正，确保输出的是一份可以直接替代原文档的、更严谨、更完整的版本。

    请以 JSON 格式返回，包含以下字段：
    - report: 评审报告的 Markdown 内容
    - revisedDocument: 修正后的完整需求文档的 Markdown 内容（必须包含全部原始内容 + 修正补充内容）
    
    **需求文档内容如下：**
    ${requirementText}

    ${images && images.length > 0 ? "此外，我还提供了一些设计图作为参考，请结合设计图进行评审。" : ""}
  `;

  const parts: any[] = [{ text: prompt }];
  if (images && images.length > 0) {
    images.forEach(img => {
      parts.push({
        inlineData: {
          mimeType: img.mimeType,
          data: img.data.split(',')[1] || img.data
        }
      });
    });
  }

  try {
    const response = await ai.models.generateContent({
      model,
      contents: { parts },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            report: { type: Type.STRING },
            revisedDocument: { type: Type.STRING }
          },
          required: ["report", "revisedDocument"]
        }
      }
    });

    if (!response.text) {
      throw new Error("AI 未返回任何内容");
    }

    return JSON.parse(response.text);
  } catch (error: any) {
    console.error("Gemini API Error (Analysis):", error);
    const errorMsg = error.message || "";
    if (errorMsg.includes("Safety")) {
      throw new Error("内容被安全过滤器拦截，请检查您的文档或图片内容。");
    }
    if (errorMsg.includes("429") || errorMsg.includes("RESOURCE_EXHAUSTED")) {
      throw new Error("API 请求配额已耗尽或请求过于频繁。请稍后再试，或在设置中配置您自己的 API Key 以获得更高配额。");
    }
    throw new Error(`需求分析失败: ${errorMsg || "未知错误"}`);
  }
}
