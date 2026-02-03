-- First delete organization_members for non-client organizations
DELETE FROM organization_members 
WHERE organization_id IN (
  SELECT o.id 
  FROM organizations o
  JOIN organization_members om ON o.id = om.organization_id
  JOIN user_roles ur ON om.user_id = ur.user_id
  WHERE ur.role IN ('admin', 'supervisor', 'fa', 'kam')
);

-- Then delete the organizations themselves
DELETE FROM organizations 
WHERE id NOT IN (
  SELECT DISTINCT om.organization_id 
  FROM organization_members om
  JOIN user_roles ur ON om.user_id = ur.user_id
  WHERE ur.role = 'cliente'
);