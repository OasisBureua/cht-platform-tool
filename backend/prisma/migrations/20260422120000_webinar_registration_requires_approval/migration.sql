-- LIVE webinars: registration survey (Jotform) then admin approval before in-app join
UPDATE "Program" SET "registrationRequiresApproval" = true WHERE "zoomSessionType" = 'WEBINAR';
