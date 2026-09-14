import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// anon key는 브라우저에 노출되어도 안전하도록 설계된 키입니다
// (실제 업로드 권한은 Supabase 버킷 정책(RLS)으로 제어됩니다)
// 참고: 신규 publishable key는 이 프로젝트의 RLS 정책과 호환 문제가 있어
// 레거시 anon(JWT) 키를 사용함
const SUPABASE_URL = 'https://oqdleiwzxgxmmvwoqgpy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9xZGxlaXd6eGd4bW12d29xZ3B5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkzMjAxNzQsImV4cCI6MjEwNDg5NjE3NH0.2dqwoYSbWFr7A0EJg3f1Vhgcu0fTYeK70bQ1BpXlXEk';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
export const MEDIA_BUCKET = 'media';
