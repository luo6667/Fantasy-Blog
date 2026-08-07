import { model, Schema, type Model } from 'mongoose';

/**
 * AI 配置（单例文档）
 *
 * 存储管理后台录入的 LLM 接入信息：
 * - baseURL / model：OpenAI 兼容接口地址与模型名
 * - apiKey：密钥，select: false 默认不返回给任何查询，
 *   仅服务端转发请求时读取，前端永远拿不到明文（防泄露）
 */
export interface AiConfigDoc {
  baseURL: string;
  apiKey: string;
  /** 模型名（避免用 model，与 Mongoose 静态方法 Model.model 冲突） */
  modelName: string;
  createdAt: Date;
  updatedAt: Date;
}

export type AiConfigModel = Model<AiConfigDoc>;

const aiConfigSchema = new Schema<AiConfigDoc, AiConfigModel>(
  {
    baseURL: { type: String, required: true, trim: true, maxlength: 500 },
    // select: false：默认查询不投影，只有显式 .select('+apiKey') 才可取回
    apiKey: { type: String, required: true, select: false },
    modelName: { type: String, required: true, trim: true, maxlength: 100 },
  },
  { timestamps: true },
);

export const AiConfig = model<AiConfigDoc, AiConfigModel>('AiConfig', aiConfigSchema);
