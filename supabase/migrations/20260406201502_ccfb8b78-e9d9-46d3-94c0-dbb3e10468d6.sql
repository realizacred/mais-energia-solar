-- Desativar duplicados legado (telefone 00000, sem user, sem email)
UPDATE consultores SET ativo = false 
WHERE id IN (
  '91bb5990-7144-4cb8-8a32-0cbd3b15fed3',
  '13f430df-e402-4672-981e-087386cb160b',
  '10addd5e-8fe1-4b5e-abd8-1000aa348343',
  '92a7caa3-d774-401a-9167-956f0a0163a9',
  'dffd676c-aaf8-477e-8cf2-fce30ee7e775',
  '58ba3416-6e5e-4f77-a806-f5bba618b86b',
  'b2ce8045-c799-4743-9452-057153440156'
);

-- Limpar slugs dos consultores reais
UPDATE consultores SET codigo = 'bruno-bandeira' WHERE id = 'c0ecc5e7-0efd-41d7-a25e-e3aff106ab67';
UPDATE consultores SET codigo = 'claudia' WHERE id = '45c1cb06-601b-49c8-a04c-dec5ab209b0c';
UPDATE consultores SET codigo = 'diego' WHERE id = '5e1a5c68-c5b2-43da-a90e-d47a7c197fa9';
UPDATE consultores SET codigo = 'ian-souza' WHERE id = 'a22287cf-4637-4a9d-b016-3410b076b9ab';
UPDATE consultores SET codigo = 'renan' WHERE id = '4138b8e1-93dd-47ae-ab29-1da96cb72d51';
UPDATE consultores SET codigo = 'sebastiao' WHERE id = '07849427-3e0f-4688-8d9d-515a03090e77';
UPDATE consultores SET codigo = 'nao-definido' WHERE id = '1627609f-aa61-45c2-b365-bdf38ff4e756';