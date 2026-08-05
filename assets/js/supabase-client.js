// Conexão com o Supabase deste projeto. Requer o SDK carregado antes deste
// script (ver <script> do supabase-js no index.html).
//
// A anon key é feita para ser pública/exposta no front-end — quem controla
// o que ela pode fazer é a Row Level Security no banco, não o sigilo da
// chave. As policies de RLS estão em supabase/schema.sql; hoje elas liberam
// acesso total (protótipo sem autenticação real — ver README).
window.supabaseClient = supabase.createClient(
  "https://xnoeuegarsmghjjxiglz.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhub2V1ZWdhcnNtZ2hqanhpZ2x6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU5MzgxMzIsImV4cCI6MjEwMTUxNDEzMn0.jPDM8alEpDlS_YPHmlHo2c8sIcSx_L8XLGJgJmPvx8o"
);
