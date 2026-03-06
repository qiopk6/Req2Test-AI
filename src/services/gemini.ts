import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

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

export async function generateTestCases(requirementText: string, images?: ImageContent[]): Promise<TestCase[]> {
  const model = "gemini-3.1-pro-preview";
  
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
    console.error("Gemini API Error:", error);
    if (error.message?.includes("Safety")) {
      throw new Error("内容被安全过滤器拦截，请检查您的文档或图片内容。");
    }
    if (error.message?.includes("Quota")) {
      throw new Error("API 配额已耗尽，请稍后再试。");
    }
    throw new Error(`生成失败: ${error.message || "未知错误"}`);
  }
}

export async function generateXMindContent(requirementText: string, images?: ImageContent[]): Promise<string> {
  const model = "gemini-3.1-pro-preview";
  
  const prompt = `
    你是一名顶级软件测试专家。我将提供整个产品的功能文档、页面设计和接口列表。请帮我生成**全套测试点思维导图结构**。
    
    【输出目标】
    根据需求文档，生成覆盖全面的测试点思维导图。

    【输出格式要求】
    1. 必须使用 **Markdown 层级结构**（使用 # 表示一级标题，## 表示二级标题，- 表示三级及以下测试点）。这种格式可以被 XMind 直接导入。
    2. 语言要求：**极度简练、专业、美观**。不要使用长句子，使用短语描述测试点。
    3. 层级结构必须如下：
       # [模块名称]
       ## 功能测试
       ## 业务流程测试
       ## 异常测试
       ## 边界测试
       ## 接口测试
       ## UI交互测试
       ## 权限测试
       ## 网络异常测试
       ## 兼容性测试
       ## 性能测试
       ## 安全测试
       ## 埋点日志测试

    4. 每个模块下必须补充完整测试点，包括：正常流程、用户异常操作、参数校验、数据异常、网络异常、边界值、权限限制。
    5. 每个功能至少生成 **10个以上测试点**。
    6. 覆盖：正常场景、异常场景、边界值测试、用户误操作、接口异常、网络异常、安全风险。

    【输出规则】
    1. 只输出 Markdown 结构。
    2. 不需要解释说明。
    3. 必须保证层级清晰。
    4. 保证测试覆盖率尽可能全面。

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
    if (error.message?.includes("Safety")) {
      throw new Error("内容被安全过滤器拦截，请检查您的文档或图片内容。");
    }
    throw new Error(`生成思维导图失败: ${error.message || "未知错误"}`);
  }
}
