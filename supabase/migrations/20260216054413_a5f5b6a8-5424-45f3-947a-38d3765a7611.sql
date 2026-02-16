UPDATE transactions 
SET type = 'transfer', is_ignored = true 
WHERE id IN (
  '1279d595-3e43-480b-b508-e5aba58893cf',
  'd078277f-ab6d-40ea-a4ec-80686fe1cef8',
  '2b80f545-4597-454c-a16a-86aa5f05726f',
  'ced95711-3697-4117-8bbb-6cf7c92d0a6c'
);