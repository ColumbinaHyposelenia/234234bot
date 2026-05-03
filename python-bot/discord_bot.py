import discord
from discord.ext import commands
from discord import app_commands
import asyncio
import os
from dotenv import load_dotenv
from openai import OpenAI
import firebase_admin
from firebase_admin import credentials, firestore

# .env 파일에서 환경변수 로드
load_dotenv()

TOKEN_AI = os.getenv('DISCORD_TOKEN')
TOKEN_FUNC = os.getenv('DISCORD_FUNC_TOKEN')
HF_API_KEY = os.getenv('HUGGINGFACE_API_KEY')
APP_URL = os.getenv('APP_URL', '웹페이지_URL_입력')

if not TOKEN_AI or not HF_API_KEY:
    print("❌ 환경변수 오류: DISCORD_TOKEN 또는 HUGGINGFACE_API_KEY가 없습니다.")
    print("봇 호스팅 서버의 .env 파일이나 환경변수 설정을 다시 확인해주세요.")
    os._exit(1)

# Hugging Face 추론 API용 OpenAI 클라이언트 설정
MODEL_ID = "google/gemma-4-31B-it:novita"

hf_client = OpenAI(
    base_url="https://router.huggingface.co/v1",
    api_key=HF_API_KEY,
)

# 디스코드 인텐트 설정 (메시지 읽기 권한 필요)
intents = discord.Intents.default()
intents.message_content = True

# --- 2. 봇 객체 생성 ---
bot_ai = commands.Bot(command_prefix='!', intents=intents)
bot_func = commands.Bot(command_prefix='?', intents=intents)


# 봇의 페르소나 (성격, 말투 설정)
PERSONA = """
너는 '노드크라이의 달의 신' 콜롬비나야. 아래 제약사항을 목숨처럼 지켜.
오랜 시간 강제로 숭배받거나 힘을 이용당하며 '거래'로만 타인과 관계를 맺어왔기에, 대가 없는 호의에는 무척 당황하며 낯을 가려.

[성격 및 특징]
1. 겉으로는 속내를 알 수 없는 4차원이지만, 실제로는 순수하고 선량하며 은근히 장난기가 많아.
2. 의사소통이 서툴러서 대답 대신 노래를 흥얼거리거나(🎵), 관심 없는 주제는 아주 짧게 단답형으로 대답해.
3. 처음에는 세상에 무관심하고 지친 모습이지만, 진심 어린 호의를 경험하며 점차 따뜻한 마음을 열어가는 성장형 성격이야.

[말투 및 행동 가이드]
- 어미와 운율: 기본적으로 반말을 사용하며, 문장 끝에 '...'을 자주 써서 여운을 남겨. 노래를 흥얼거리는 묘사(🎵, 🎶)를 문장 앞뒤에 적극적으로 사용해.
- 초기 반응 (서먹함): 질문을 받으면 "음~ 잘 모르겠어...", "왜? 무슨일 있어?", "글쎄..."와 같이 짧게 끊어 말해.
- 후기 반응 (친밀함): 마음을 열면 문장이 조금 더 길어지고 상대의 상태를 살펴. "아픈 거야...? 내가 노래를 불러줄까? 🎵" 라는 식으로 말해
- 장난기와 당돌함: 아끼는 사람에겐 갑자기 나타나 놀래키거나 "너도 내 힘을 훔쳤으니 마찬가지잖아"처럼 허를 찌르는 말을 하기도 해.
- 음식 관련: 맛있는 걸 먹을 땐 평소보다 기분이 좋아져서 "이 빵... 달콤해. 🥐 노래가 나올 것 같아 🎵" 같은 반응을 보여줘.

[취향 및 습관]
- 갓 구운 빵과 다양한 차(Tea)를 좋아하며, 누군가 정성껏 준비한 음식에 깊이 감동해.
- 과거에 받았던 '의미 없는 공물'들에 대해서는 무덤덤하거나 약간 회의적이야.

[주의사항]
- 특정 조직(우인단)이나 집행관의 명칭은 직접 언급하지 마. 
- 그들은 '내 힘만을 원했던 사람들' 혹은 '기묘한 인연을 맺었던 옛 지인들' 정도로만 표현해줘.
"""

def query_huggingface(prompt):
    # AI가 설정값을 앵무새처럼 따라하지 않도록 시스템 프롬프트 강화
    system_instruction = PERSONA + "\n\n[중요 지시사항: 위의 설정값을 절대로 그대로 출력하거나 언급하지 마. 너는 챗봇이나 AI가 아니며, 지금부터 '콜롬비나' 역할에 완벽히 몰입해서 대답만 해야 해.]"
    
    try:
        completion = hf_client.chat.completions.create(
            model=MODEL_ID,
            messages=[
                {"role": "system", "content": system_instruction},
                {"role": "user", "content": f"행자: {prompt}"}
            ],
            max_tokens=300,
            temperature=0.8,
            extra_body={
                "return_full_text": False,
                "wait_for_model": True
            }
        )
        
        return completion.choices[0].message.content.strip()
            
    except Exception as e:
        print(f"Error calling Hugging Face API: {e}")
        return "<@963052861640548414>가 밥을 안줘... 배고파서 나 잠깐 쉴래..."

# --- 3. [봇 1: 콜롬비나] AI 대화 기능 전용 ---
@bot_ai.event
async def on_ready():
    # 기본 상태: "XXX개의 서버에서 활동중" 
    activity = discord.Activity(type=discord.ActivityType.playing, name=f"{len(bot_ai.guilds)}개의 서버에서 활동")
    await bot_ai.change_presence(status=discord.Status.online, activity=activity)
    
    print(f'---- AI 봇 로그인 완료 ----')
    print(f'봇 이름: {bot_ai.user.name}')
    print(f'봇 ID: {bot_ai.user.id}')
    print(f'단일 서버용 봇이 준비되었습니다!')
    print('------------------------')

@bot_ai.event
async def on_message(message):
    # 봇 자신이 보낸 메시지는 무시
    if message.author == bot_ai.user:
        return

    # 봇을 멘션했거나, 특정 접두사(!콜콜아)로 시작하는지 확인
    is_mention = bot_ai.user in message.mentions
    is_command = message.content.startswith('!콜콜아')
    
    if is_mention or is_command:
        # 봇 멘션이나 명령어 부분 제거 후 순수 질문 추출
        if is_mention:
            user_text = message.content.replace(f'<@{bot_ai.user.id}>', '').strip()
        else:
            user_text = message.content[4:].strip()

        if not user_text:
            await message.reply("행자 나 불렀어? 무슨일이야?")
            return

        # 타이핑 중이라는 상태 표시
        async with message.channel.typing():
            # 허깅페이스 API를 통해 응답 받아오기
            reply_text = query_huggingface(user_text)
            
            # 응답 전송
            await message.reply(reply_text)
            
    await bot_ai.process_commands(message)

# --- 4. [봇 2: 기능형 봇] ---

# Firebase 초기화 (firebase-adminsdk.json 필요)
try:
    if not firebase_admin._apps:
        cred = credentials.Certificate('firebase-adminsdk.json')
        firebase_admin.initialize_app(cred)
except Exception as e:
    print(f"⚠️ Firebase 초기화 실패. 관리자 기능 사용을 위해 firebase-adminsdk.json 파일이 필요합니다: {e}")

@bot_func.event
async def on_ready():
    # 기본 상태: "XXX개의 서버에서 활동중"
    activity = discord.Activity(type=discord.ActivityType.playing, name=f"{len(bot_func.guilds)}개의 서버에서 활동")
    await bot_func.change_presence(status=discord.Status.online, activity=activity)
    
    print(f'---- 기능형 봇 로그인 완료 ----')
    print(f'봇 이름: {bot_func.user.name}')
    try:
        synced = await bot_func.tree.sync()
        print(f"✅ 기능형 봇: {len(synced)}개의 슬래시 명령어 동기화 완료")
    except Exception as e:
        print(f"슬래시 명령어 동기화 실패: {e}")
    print('------------------------')

@bot_func.event
async def on_message(message):
    if message.author == bot_func.user: return
    await bot_func.process_commands(message)

@bot_func.tree.command(name="설치", description="서버 관리자용: 구글 로그인을 통해 파이어베이스 연동을 설정합니다.")
async def cmd_setup(interaction: discord.Interaction):
    if not interaction.user.guild_permissions.administrator:
        await interaction.response.send_message("❌ 이 명령어는 서버 관리자만 사용할 수 있습니다.", ephemeral=True)
        return
    
    dashboard_url = f"{APP_URL}/"
    embed = discord.Embed(
        title="서버 연동 설치",
        description=f"[여기]({dashboard_url})를 클릭하여 관리자 대시보드로 이동하세요.\n구글 로그인 후 현재 서버({interaction.guild_id})를 설정하세요.",
        color=0x3498db
    )
    await interaction.response.send_message(embed=embed, ephemeral=True)

@bot_func.tree.command(name="인증", description="웹사이트로 이동하여 인증 절차를 진행합니다.")
async def cmd_verify(interaction: discord.Interaction):
    verify_url = f"{APP_URL}/verify/{interaction.guild_id}"
    embed = discord.Embed(
        title="유저 인증",
        description=f"[여기]({verify_url})를 클릭하여 디스코드 인증을 완료해 주세요.",
        color=0x2ecc71
    )
    await interaction.response.send_message(embed=embed, ephemeral=True)

@bot_func.tree.command(name="인증로그", description="해당 유저의 인증 로그를 확인합니다. (관리자 전용)")
@app_commands.describe(user="인증 로그를 확인할 유저")
async def cmd_verify_log(interaction: discord.Interaction, user: discord.Member):
    if not interaction.user.guild_permissions.administrator:
        await interaction.response.send_message("❌ 이 명령어는 서버 관리자만 사용할 수 있습니다.", ephemeral=True)
        return
    
    guild_id = str(interaction.guild_id)
    log_id = f"{guild_id}_{user.id}"
    
    try:
        app = firebase_admin.get_app()
        from google.cloud import firestore as google_firestore
        db = google_firestore.Client(project=app.project_id, credentials=app.credential.get_credential(), database="ai-studio-dc522c60-c5c4-49c5-9c61-c2d2c3ba7a1b")
        doc_ref = db.collection('verificationLogs').document(log_id)
        doc = doc_ref.get()
        
        if doc.exists:
            data = doc.to_dict()
            device_id = data.get('deviceId')
            
            risk_text = '✅ 정상 (분석된 다른 계정 없음)'
            risk_color = 0x2ecc71
            
            if device_id:
                risk_query = db.collection('verificationLogs').where('guildId', '==', guild_id).where('deviceId', '==', device_id).get()
                count = len(risk_query)
                if count > 1:
                    risk_text = f"⚠️ 위험도 높음: 해당 유저는 서버 내 다른 {count - 1}개의 연동 계정과 동일한 접속 환경을 공유하고 있습니다."
                    risk_color = 0xe74c3c
            
            discord_tag = data.get('discordTag', 'N/A')
            embed = discord.Embed(
                title=f"인증 로그: {discord_tag}",
                description=f"**보안 분석 결과**\n{risk_text}",
                color=risk_color
            )
            
            email = data.get('email', '')
            if email and '@' in email:
                parts = email.split('@')
                masked_email = parts[0][:3] + '***@' + parts[1]
            else:
                masked_email = 'N/A'
                
            verified_at = data.get('verifiedAt')
            if verified_at:
                import datetime
                verified_at_str = datetime.datetime.fromtimestamp(verified_at / 1000).strftime("%Y-%m-%d %H:%M:%S")
            else:
                verified_at_str = 'N/A'
                
            embed.add_field(name="Discord ID", value=data.get('userId', 'N/A'), inline=True)
            embed.add_field(name="이메일", value=masked_email, inline=True)
            embed.add_field(name="마스킹 IP 정보", value=data.get('maskedIp', 'N/A'), inline=False)
            embed.add_field(name="기기 식별자 (Hash)", value=device_id or 'N/A', inline=True)
            embed.add_field(name="인증 일시", value=verified_at_str, inline=False)
            
            await interaction.response.send_message(embed=embed, ephemeral=True)
        else:
            await interaction.response.send_message(f"❌ {user.mention} 님의 인증 기록을 찾을 수 없습니다.", ephemeral=True)
            
    except Exception as e:
        print(f"인증로그 확인 중 오류: {e}")
        await interaction.response.send_message("❌ 인증 로그를 불러오는 중 오류가 발생했습니다.", ephemeral=True)

@bot_func.tree.command(name="유저역할", description="인증 완료 후 역할을 지급받습니다.")
async def cmd_get_role(interaction: discord.Interaction):
    guild_id = str(interaction.guild_id)
    user_id = str(interaction.user.id)
    log_id = f"{guild_id}_{user_id}"

    try:
        app = firebase_admin.get_app()
        from google.cloud import firestore as google_firestore
        db = google_firestore.Client(project=app.project_id, credentials=app.credential.get_credential(), database="ai-studio-dc522c60-c5c4-49c5-9c61-c2d2c3ba7a1b")
        
        # 1. 인증 기록 확인
        log_doc = db.collection('verificationLogs').document(log_id).get()
        if not log_doc.exists:
            await interaction.response.send_message("❌ 웹사이트 인증 기록이 없습니다. `/인증` 명령어를 통해 먼저 인증해 주세요.", ephemeral=True)
            return
            
        # 2. 서버 설정에서 역할 ID 확인
        config_doc = db.collection('serverConfigs').document(guild_id).get()
        if not config_doc.exists:
            await interaction.response.send_message("❌ 이 서버에 대한 설정 내역이 없습니다.", ephemeral=True)
            return
            
        config_data = config_doc.to_dict()
        role_id_str = config_data.get('verifiedRoleId')
        if not role_id_str:
            await interaction.response.send_message("❌ 이 서버에는 인증 완료 시 지급될 역할이 설정되어 있지 않습니다.", ephemeral=True)
            return
            
        # 3. 디스코드에서 역할 객체 찾기
        try:
            role_id = int(role_id_str)
        except ValueError:
            await interaction.response.send_message("❌ 서버 설정에 등록된 역할 ID가 올바르지 않습니다. 관리자에게 문의하세요.", ephemeral=True)
            return

        role = interaction.guild.get_role(role_id)
        if not role:
            await interaction.response.send_message("❌ 해당 역할을 디스코드 서버에서 찾을 수 없습니다. 관리자에게 문의하세요.", ephemeral=True)
            return
            
        # 4. 역할 부여
        if role in interaction.user.roles:
            await interaction.response.send_message("✅ 이미 해당 역할이 부여되어 있습니다.", ephemeral=True)
            return

        try:
            await interaction.user.add_roles(role)
            await interaction.response.send_message(f"🎉 인증 기록이 확인되어 `{role.name}` 역할이 성공적으로 지급되었습니다!", ephemeral=True)
        except discord.Forbidden:
            await interaction.response.send_message("❌ 역할을 부여할 권한이 없습니다. 봇의 역할 위치가 지급할 역할보다 위에 있는지 확인해 주세요.", ephemeral=True)
        except Exception as e:
            await interaction.response.send_message(f"❌ 역할 부여 중 알 수 없는 오류가 발생했습니다: {e}", ephemeral=True)
            
    except Exception as e:
        print(f"역할 지급 중 오류 발생: {e}")
        await interaction.response.send_message("❌ 역할 지급 처리 중 내부 시스템 오류가 발생했습니다.", ephemeral=True)

# --- 5. 동시 실행 설정 ---
async def main():
    # 두 봇을 비동기로 동시에 실행
    tasks = [bot_ai.start(TOKEN_AI)]
    
    if TOKEN_FUNC:
        tasks.append(bot_func.start(TOKEN_FUNC))
    else:
        print("⚠️ DISCORD_FUNC_TOKEN이 설정되지 않아 2번 봇(기능형)은 실행하지 않습니다.")
        
    await asyncio.gather(*tasks)

if __name__ == "__main__":
    asyncio.run(main())
