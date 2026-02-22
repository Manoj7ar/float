CREATE POLICY "Users can delete own calls"
ON public.calls
FOR DELETE
USING (account_id IN (
  SELECT accounts.id FROM accounts WHERE accounts.user_id = auth.uid()
));