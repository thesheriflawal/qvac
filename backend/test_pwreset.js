#!/usr/bin/env node
/**
 * Full password reset flow tester for Kynettic backend.
 *
 * Flow:
 *  1. POST /api/v1/auth/forgot-password/request-otp  (send OTP to email)
 *  2. Read OTP from email, enter it at the prompt
 *  3. POST /api/v1/auth/forgot-password/verify-otp   (get reset_token)
 *  4. POST /api/v1/auth/forgot-password/reset        (set new password)
 *  5. (Optional) POST /api/v1/auth/login             (verify login works)
 *
 * Usage:
 *   node test_pwreset_flow.js <email> [baseUrl] [newPassword]
 *
 * Example:
 *   node test_pwreset_flow.js user@example.com
 *   node test_pwreset_flow.js user@example.com http://localhost:8080 "MyNewStrongP@ssw0rd!"
 */

import readline from 'node:readline';

const email = process.argv[2];
const baseUrl = process.argv[3] ?? 'http://localhost:8080';
const newPassword =
  process.argv[4] ?? 'TempP@ssw0rd123!'; // must satisfy backend strength rules

if (!email) {
  console.error('Usage: node test_pwreset_flow.js <email> [baseUrl] [newPassword]');
  process.exit(1);
}

function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function requestPasswordResetOTP() {
  console.log('\n=== 1) Request password reset OTP ===');
  const res = await fetch(`${baseUrl}/api/v1/auth/forgot-password/request-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });

  const body = await res.json().catch(() => ({}));
  console.log('Status:', res.status);
  console.log('Response:', JSON.stringify(body, null, 2));

  if (!res.ok || body.success === false) {
    throw new Error(`Failed to request OTP: ${body.message || res.statusText}`);
  }
}

async function verifyPasswordResetOTP(otp) {
  console.log('\n=== 2) Verify password reset OTP ===');
  const res = await fetch(`${baseUrl}/api/v1/auth/forgot-password/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, otp }),
  });

  const body = await res.json().catch(() => ({}));
  console.log('Status:', res.status);
  console.log('Response:', JSON.stringify(body, null, 2));

  if (!res.ok || body.success === false || !body.data?.reset_token) {
    throw new Error(`Failed to verify OTP: ${body.message || res.statusText}`);
  }

  return body.data.reset_token;
}

async function resetPassword(resetToken) {
  console.log('\n=== 3) Reset password using reset_token ===');
  const res = await fetch(`${baseUrl}/api/v1/auth/forgot-password/reset`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      reset_token: resetToken,
      new_password: newPassword,
    }),
  });

  const body = await res.json().catch(() => ({}));
  console.log('Status:', res.status);
  console.log('Response:', JSON.stringify(body, null, 2));

  if (!res.ok || body.success === false) {
    throw new Error(`Failed to reset password: ${body.message || res.statusText}`);
  }
}

async function testLogin() {
  console.log('\n=== 4) Test login with new password (optional) ===');
  const res = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password: newPassword,
    }),
  });

  const body = await res.json().catch(() => ({}));
  console.log('Status:', res.status);
  console.log('Response:', JSON.stringify(body, null, 2));

  if (!res.ok || body.success === false) {
    throw new Error(`Login with new password failed: ${body.message || res.statusText}`);
  }
}

(async function main() {
  try {
    console.log(`Base URL: ${baseUrl}`);
    console.log(`Email:    ${email}`);
    console.log(`New PW:   ${newPassword}\n`);

    await requestPasswordResetOTP();
    console.log('\nCheck your email for the 6-digit OTP.');

    const otp = await prompt('Enter the OTP you received: ');
    if (!otp) {
      throw new Error('No OTP entered.');
    }

    const resetToken = await verifyPasswordResetOTP(otp);
    console.log('\nGot reset_token:', resetToken);

    await resetPassword(resetToken);

    const doLogin = (await prompt('\nTest login with new password? (y/N): ')).toLowerCase();
    if (doLogin === 'y' || doLogin === 'yes') {
      await testLogin();
    }

    console.log('\n✅ Password reset flow completed successfully.');
  } catch (err) {
    console.error('\n❌ Error during password reset flow:', err.message || err);
    process.exit(1);
  }
})();