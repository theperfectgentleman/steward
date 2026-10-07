-- ============================================================================
-- Steward: Replicate "Accra North Region" Organization on Remote Database
-- Idempotent PostgreSQL Migration Script
-- ============================================================================

DO $$
DECLARE
  v_org_id TEXT := 'org_accra_north';
  v_org_slug TEXT := 'accra-north-region';
  v_org_name TEXT := 'Accra North Region';
  v_admin_id TEXT;
  v_it_id TEXT;
  v_chair_id TEXT;
  v_sg_id TEXT;
  v_comm_finance_id TEXT := 'comm_accra_north_fin';
  v_comm_estates_id TEXT := 'comm_accra_north_est';
  v_default_password_hash TEXT := '$2b$12$4dwCafSv2pEl8Lfnchio5.kSDh.P/XBaq8rpLFPRCSk/blIpFEYny'; -- Steward123!
BEGIN

  -- --------------------------------------------------------------------------
  -- 1. Ensure Users Exist (admin, it, and dummy chairperson)
  -- --------------------------------------------------------------------------

  -- 1a. admin@unitycommit.org
  SELECT id INTO v_admin_id FROM "User" WHERE email = 'admin@unitycommit.org';
  IF v_admin_id IS NULL THEN
    v_admin_id := 'usr_admin_unity';
    INSERT INTO "User" (
      id, name, email, phone, role, status, "emailVerifiedAt", "passwordHash", "createdAt", "updatedAt"
    ) VALUES (
      v_admin_id, 'Joseph Osei', 'admin@unitycommit.org', '+233 24 000 0001',
      'ORG_ADMIN', 'ACTIVE', NOW(), v_default_password_hash, NOW(), NOW()
    );
  END IF;

  -- 1b. it@unitycommit.org
  SELECT id INTO v_it_id FROM "User" WHERE email = 'it@unitycommit.org';
  IF v_it_id IS NULL THEN
    v_it_id := 'usr_it_unity';
    INSERT INTO "User" (
      id, name, email, phone, role, status, "emailVerifiedAt", "passwordHash", "createdAt", "updatedAt"
    ) VALUES (
      v_it_id, 'IT Systems Admin', 'it@unitycommit.org', '+233 24 000 0006',
      'ORG_TECH', 'ACTIVE', NOW(), v_default_password_hash, NOW(), NOW()
    );
  END IF;

  -- 1c. Dummy chairperson: chair.accranorth@unitycommit.org
  SELECT id INTO v_chair_id FROM "User" WHERE email = 'chair.accranorth@unitycommit.org';
  IF v_chair_id IS NULL THEN
    v_chair_id := 'usr_chair_accranorth';
    INSERT INTO "User" (
      id, name, email, phone, role, status, "emailVerifiedAt", "passwordHash", "createdAt", "updatedAt"
    ) VALUES (
      v_chair_id, 'Elder Emmanuel Darko', 'chair.accranorth@unitycommit.org', '+233 24 111 0001',
      'ORG_PARTICIPANT', 'ACTIVE', NOW(), v_default_password_hash, NOW(), NOW()
    );
  ELSE
    UPDATE "User"
    SET name = 'Elder Emmanuel Darko', status = 'ACTIVE', "passwordHash" = v_default_password_hash
    WHERE id = v_chair_id;
  END IF;

  -- --------------------------------------------------------------------------
  -- 2. Ensure Organization "Accra North Region"
  -- --------------------------------------------------------------------------
  SELECT id INTO v_org_id FROM "Organization" WHERE slug = v_org_slug;
  IF v_org_id IS NULL THEN
    v_org_id := 'org_accra_north';
    INSERT INTO "Organization" (id, name, slug, status, "createdAt", "updatedAt")
    VALUES (v_org_id, v_org_name, v_org_slug, 'ACTIVE', NOW(), NOW());
  ELSE
    UPDATE "Organization"
    SET name = v_org_name, status = 'ACTIVE', "updatedAt" = NOW()
    WHERE id = v_org_id;
  END IF;

  -- --------------------------------------------------------------------------
  -- 3. Ensure OrganizationSettings
  -- --------------------------------------------------------------------------
  INSERT INTO "OrganizationSettings" (
    id, "organizationId", "supervisoryLabel", "committeeLabel",
    "committeeBudgetsEnabled", "allowCrossCommitteeRead",
    "requireOversightOnSelfInitiated", "allowSupervisoryAssignMembers",
    "directiveApprovalStack", "committeeApprovalStack", "updatedAt"
  ) VALUES (
    'set_' || v_org_id,
    v_org_id,
    'Presbytery',
    'Committee',
    true,
    false,
    true,
    true,
    '[{"role":"COMMITTEE_SECRETARY","label":"Secretary","order":1},{"role":"COMMITTEE_CHAIR","label":"Chair","order":2},{"role":"SUPERVISORY_SECRETARY","label":"General Secretary","order":3},{"role":"SUPERVISORY_HEAD","label":"General Overseer","order":4}]'::jsonb,
    '[{"role":"COMMITTEE_SECRETARY","label":"Secretary","order":1},{"role":"COMMITTEE_CHAIR","label":"Chair","order":2}]'::jsonb,
    NOW()
  )
  ON CONFLICT ("organizationId") DO UPDATE SET
    "supervisoryLabel" = EXCLUDED."supervisoryLabel",
    "committeeLabel" = EXCLUDED."committeeLabel",
    "committeeBudgetsEnabled" = EXCLUDED."committeeBudgetsEnabled",
    "directiveApprovalStack" = EXCLUDED."directiveApprovalStack",
    "committeeApprovalStack" = EXCLUDED."committeeApprovalStack",
    "updatedAt" = NOW();

  -- --------------------------------------------------------------------------
  -- 4. Ensure Supervisory Group ("Presbytery")
  -- --------------------------------------------------------------------------
  SELECT id INTO v_sg_id FROM "SupervisoryGroup" WHERE "organizationId" = v_org_id;
  IF v_sg_id IS NULL THEN
    v_sg_id := 'sg_' || v_org_id;
    INSERT INTO "SupervisoryGroup" (id, name, "organizationId", "createdAt", "updatedAt")
    VALUES (v_sg_id, 'Presbytery', v_org_id, NOW(), NOW());
  ELSE
    UPDATE "SupervisoryGroup"
    SET name = 'Presbytery', "updatedAt" = NOW()
    WHERE id = v_sg_id;
  END IF;

  -- --------------------------------------------------------------------------
  -- 5. Ensure Role Templates (Individual statements to prevent tuple count mismatches)
  -- --------------------------------------------------------------------------
  INSERT INTO "RoleTemplate" (id, "organizationId", key, name, description, capabilities, "sortOrder")
  VALUES ('rt_' || v_org_id || '_chair', v_org_id, 'CHAIR', 'Chairperson', 'Committee chairperson',
    '{"editTasks":true,"logMinutes":true,"approveMinutes":true,"invite":false,"updateAssignedTasks":true,"canViewAll":false,"canCreateDirective":false,"canApproveOptional":false}'::jsonb, 1)
  ON CONFLICT ("organizationId", key) DO UPDATE SET
    name = EXCLUDED.name, description = EXCLUDED.description, capabilities = EXCLUDED.capabilities, "sortOrder" = EXCLUDED."sortOrder";

  INSERT INTO "RoleTemplate" (id, "organizationId", key, name, description, capabilities, "sortOrder")
  VALUES ('rt_' || v_org_id || '_deputy', v_org_id, 'DEPUTY', 'Deputy', 'Deputy chair',
    '{"editTasks":true,"logMinutes":true,"approveMinutes":false,"invite":false,"updateAssignedTasks":true,"canViewAll":false,"canCreateDirective":false,"canApproveOptional":false}'::jsonb, 2)
  ON CONFLICT ("organizationId", key) DO UPDATE SET
    name = EXCLUDED.name, description = EXCLUDED.description, capabilities = EXCLUDED.capabilities, "sortOrder" = EXCLUDED."sortOrder";

  INSERT INTO "RoleTemplate" (id, "organizationId", key, name, description, capabilities, "sortOrder")
  VALUES ('rt_' || v_org_id || '_sec', v_org_id, 'SECRETARY', 'Secretary', 'Committee secretary',
    '{"editTasks":true,"logMinutes":true,"approveMinutes":false,"invite":false,"updateAssignedTasks":true,"canViewAll":false,"canCreateDirective":false,"canApproveOptional":false}'::jsonb, 3)
  ON CONFLICT ("organizationId", key) DO UPDATE SET
    name = EXCLUDED.name, description = EXCLUDED.description, capabilities = EXCLUDED.capabilities, "sortOrder" = EXCLUDED."sortOrder";

  INSERT INTO "RoleTemplate" (id, "organizationId", key, name, description, capabilities, "sortOrder")
  VALUES ('rt_' || v_org_id || '_mem', v_org_id, 'MEMBER', 'Member', 'Committee member',
    '{"editTasks":false,"logMinutes":false,"approveMinutes":false,"invite":false,"updateAssignedTasks":true,"canViewAll":false,"canCreateDirective":false,"canApproveOptional":false}'::jsonb, 4)
  ON CONFLICT ("organizationId", key) DO UPDATE SET
    name = EXCLUDED.name, description = EXCLUDED.description, capabilities = EXCLUDED.capabilities, "sortOrder" = EXCLUDED."sortOrder";

  INSERT INTO "RoleTemplate" (id, "organizationId", key, name, description, capabilities, "sortOrder")
  VALUES ('rt_' || v_org_id || '_gov_head', v_org_id, 'SUPERVISORY_HEAD', 'General Overseer', 'Sees all groups and assigns directives',
    '{"editTasks":false,"logMinutes":false,"approveMinutes":false,"invite":false,"updateAssignedTasks":false,"canViewAll":true,"canCreateDirective":true,"canApproveOptional":true}'::jsonb, 10)
  ON CONFLICT ("organizationId", key) DO UPDATE SET
    name = EXCLUDED.name, description = EXCLUDED.description, capabilities = EXCLUDED.capabilities, "sortOrder" = EXCLUDED."sortOrder";

  INSERT INTO "RoleTemplate" (id, "organizationId", key, name, description, capabilities, "sortOrder")
  VALUES ('rt_' || v_org_id || '_gov_sec', v_org_id, 'SUPERVISORY_SECRETARY', 'General Secretary', 'Sees all groups and assigns directives',
    '{"editTasks":false,"logMinutes":false,"approveMinutes":false,"invite":false,"updateAssignedTasks":false,"canViewAll":true,"canCreateDirective":true,"canApproveOptional":true}'::jsonb, 11)
  ON CONFLICT ("organizationId", key) DO UPDATE SET
    name = EXCLUDED.name, description = EXCLUDED.description, capabilities = EXCLUDED.capabilities, "sortOrder" = EXCLUDED."sortOrder";

  INSERT INTO "RoleTemplate" (id, "organizationId", key, name, description, capabilities, "sortOrder")
  VALUES ('rt_' || v_org_id || '_gov_mem', v_org_id, 'SUPERVISORY_MEMBER', 'Presbytery member', 'Governance participant without org-wide view',
    '{"editTasks":false,"logMinutes":false,"approveMinutes":false,"invite":false,"updateAssignedTasks":false,"canViewAll":false,"canCreateDirective":false,"canApproveOptional":false}'::jsonb, 12)
  ON CONFLICT ("organizationId", key) DO UPDATE SET
    name = EXCLUDED.name, description = EXCLUDED.description, capabilities = EXCLUDED.capabilities, "sortOrder" = EXCLUDED."sortOrder";

  -- --------------------------------------------------------------------------
  -- 6. Ensure 2 Demo Committees (Finance & Estates)
  -- --------------------------------------------------------------------------
  -- Finance Committee (Charter A)
  INSERT INTO "Committee" (
    id, "organizationId", "charterLetter", name, description, budget, "reportingFrequency", "sortOrder", "createdAt", "updatedAt"
  ) VALUES (
    v_comm_finance_id, v_org_id, 'a', 'Finance Committee',
    'Finance Committee — regional charter committee A', 12000, 'Monthly', 1, NOW(), NOW()
  )
  ON CONFLICT ("organizationId", "charterLetter") DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    budget = EXCLUDED.budget,
    "reportingFrequency" = EXCLUDED."reportingFrequency",
    "updatedAt" = NOW();

  -- Estates & Projects Management (Charter C)
  INSERT INTO "Committee" (
    id, "organizationId", "charterLetter", name, description, budget, "reportingFrequency", "sortOrder", "createdAt", "updatedAt"
  ) VALUES (
    v_comm_estates_id, v_org_id, 'c', 'Estates & Projects Management',
    'Estates & Projects Management — regional charter committee C', 14000, 'Monthly', 2, NOW(), NOW()
  )
  ON CONFLICT ("organizationId", "charterLetter") DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    budget = EXCLUDED.budget,
    "reportingFrequency" = EXCLUDED."reportingFrequency",
    "updatedAt" = NOW();

  -- Retrieve authoritative committee ID for Finance
  SELECT id INTO v_comm_finance_id FROM "Committee" WHERE "organizationId" = v_org_id AND "charterLetter" = 'a';

  -- --------------------------------------------------------------------------
  -- 7. Ensure Organization Memberships
  -- --------------------------------------------------------------------------
  -- admin@unitycommit.org -> ORG_ADMIN
  INSERT INTO "OrganizationMembership" (id, "organizationId", "userId", role, "createdAt", "updatedAt")
  VALUES ('mem_' || v_org_id || '_admin', v_org_id, v_admin_id, 'ORG_ADMIN', NOW(), NOW())
  ON CONFLICT ("organizationId", "userId") DO UPDATE SET role = 'ORG_ADMIN', "updatedAt" = NOW();

  -- it@unitycommit.org -> ORG_TECH
  INSERT INTO "OrganizationMembership" (id, "organizationId", "userId", role, "createdAt", "updatedAt")
  VALUES ('mem_' || v_org_id || '_it', v_org_id, v_it_id, 'ORG_TECH', NOW(), NOW())
  ON CONFLICT ("organizationId", "userId") DO UPDATE SET role = 'ORG_TECH', "updatedAt" = NOW();

  -- dummy chair -> ORG_PARTICIPANT
  INSERT INTO "OrganizationMembership" (id, "organizationId", "userId", role, "createdAt", "updatedAt")
  VALUES ('mem_' || v_org_id || '_chair', v_org_id, v_chair_id, 'ORG_PARTICIPANT', NOW(), NOW())
  ON CONFLICT ("organizationId", "userId") DO UPDATE SET role = 'ORG_PARTICIPANT', "updatedAt" = NOW();

  -- --------------------------------------------------------------------------
  -- 8. Assign Dummy Chair to Finance Committee
  -- --------------------------------------------------------------------------
  INSERT INTO "CommitteeMember" (id, "userId", "committeeId", title, "customTitle")
  VALUES ('cm_' || v_org_id || '_chair_fin', v_chair_id, v_comm_finance_id, 'CHAIR', 'Finance Committee Chairperson')
  ON CONFLICT ("userId", "committeeId") DO UPDATE SET
    title = 'CHAIR',
    "customTitle" = 'Finance Committee Chairperson';

  RAISE NOTICE 'Successfully configured Accra North Region organization (Org ID: %)', v_org_id;
END $$;
