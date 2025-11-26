import { NextRequest, NextResponse } from 'next/server';

// 用户名固定为 admin，只允许通过环境变量配置密码
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = process.env.LOGIN_PASSWORD || 'affadsense';

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();

    // 验证用户名和密码
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      // 创建一个简单的 token
      const token = Buffer.from(`${username}:${Date.now()}`).toString('base64');

      const response = NextResponse.json({
        success: true,
        message: '登录成功'
      });

      // 设置 cookie
      response.cookies.set('admin_token', token, {
        httpOnly: true,
        secure: false, // 在 HTTP 环境也能工作
        sameSite: 'lax', // 改为 lax 以支持跨域场景
        maxAge: 60 * 60 * 24, // 24 小时
        path: '/' // 确保在所有路径下都有效
      });

      return response;
    } else {
      return NextResponse.json(
        { success: false, message: '密码错误' },
        { status: 401 }
      );
    }
  } catch (error) {
    return NextResponse.json(
      { success: false, message: '登录失败' },
      { status: 500 }
    );
  }
}
